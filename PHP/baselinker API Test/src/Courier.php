<?php

declare(strict_types=1);

final class Courier
{
    private string $baseUrl = 'https://developers.baselinker.com/recruitment/api';
    private string $apiKey = '';

    public function newPackage(array $order, array $params): string
    {
        $tracking = '';
        $this->apiKey = (string) ($params['api_key'] ?? '');

        if ($this->validateParams($params)) {
            $orderData = $this->processOrderData($order);
            $payload = [
                'Apikey' => $this->apiKey,
                'Command' => 'OrderShipment',
                'Shipment' => [
                    'Service' => (string) $params['service'],
                    'ShipperReference' => (string) $params['shipper_reference'],
                    // ShipmentValue is documented as optional, but the API returns an error if this field is missing
                    'ShipmentValue' => (float) ($params['shipment_value']),
                    'Weight' => (float) $params['weight'],
                    'ConsignorAddress' => [
                        'FullName' => (string) ($orderData['sender_fullname'] ?? ''),
                        'Company' => (string) ($orderData['sender_company'] ?? ''),
                        ...($orderData['sender_address_lines'] ?? []),
                        'City' => (string) ($orderData['sender_city']),
                        'Zip' => (string) ($orderData['sender_postalcode'] ?? ''),
                        'Phone' => (string) ($orderData['sender_phone'] ?? ''),
                        'Email' => (string) ($orderData['sender_email'] ?? ''),
                    ],
                    'ConsigneeAddress' => [
                        'FullName' => (string) ($orderData['delivery_fullname'] ?? ''),
                        'Company' => (string) ($orderData['delivery_company'] ?? ''),
                        ...($orderData['delivery_address_lines'] ?? []),
                        'City' => (string) ($orderData['delivery_city'] ?? ''),
                        'Zip' => (string) ($orderData['delivery_postalcode'] ?? ''),
                        'Country' => (string) ($orderData['delivery_country'] ?? ''),
                        'Phone' => (string) ($orderData['delivery_phone'] ?? ''),
                        'Email' => (string) ($orderData['delivery_email'] ?? ''),
                    ],
                    'Products' => [],
                    'LabelFormat' => (string) $params['label_format'],
                ],
            ];
            $response = $this->request('post', $payload);
            
            $this->assertApiSuccess($response, 'Shipment creation failed');

            $tracking = $response['Shipment']['TrackingNumber'] ?? '';

            if (!is_string($tracking) || trim($tracking) === '') {
                $this->renderError(
                    'Shipment created but TrackingNumber missing or invalid',
                    $response
                );
            }
        }

        return $tracking;
    }

    public function packagePDF(string $trackingNumber): void
    {
        $payload = [
            'Apikey' => $this->apiKey,
            'Command' => 'GetShipmentLabel',
            'Shipment' => [
                'TrackingNumber' => $trackingNumber,
                'LabelFormat' => 'PDF',
            ],
        ];

        $response = $this->request('post', $payload);
        $this->assertApiSuccess($response, 'Label download failed');

        $labelBase64 = $response['Shipment']['LabelImage'] ?? null;

        if (!is_string($labelBase64) || $labelBase64 === '') {
            $this->renderError('LabelImage not found', $response);
            return;
        }

        $pdf = base64_decode($labelBase64, true);

        if ($pdf === false) {
            $this->renderError('Invalid label base64', $response);
            return;
        }

        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="label-' . $trackingNumber . '.pdf"');
        header('Content-Length: ' . (string) strlen($pdf));

        echo $pdf;

        exit;
    }

    private function request(string $method, array $payload): array
    {
        $request = null;

        try {
            if (empty($payload)) {
                return [
                    'ErrorLevel' => 1,
                    'ErrorCode' => 'VALIDATION_ERROR',
                    'Error' => 'Empty payload',
                    'Details' => 'Request payload cannot be empty',
                ];
            }
            $request = curl_init($this->baseUrl); 
            
            if (!$request instanceof CurlHandle) {
                return [
                    'ErrorLevel' => 2,
                    'ErrorCode' => 'SYSTEM_ERROR',
                    'Error' => 'Failed to initialize cURL',
                    'Details' => 'curl_init returned an invalid handle',
                ];
            }
$options = [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CUSTOMREQUEST => strtoupper($method),
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Accept: application/json',
                ],
                CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR),
                CURLOPT_CONNECTTIMEOUT => 10,
                CURLOPT_TIMEOUT => 30,
            ];
            
            curl_setopt_array($request, $options); 
            $response = curl_exec($request);

            

            if ($response === false) {
                $data = [
                    'ErrorLevel' => 2,
                    'ErrorCode' => 'SYSTEM_ERROR',
                    'Error' => 'Connection error while calling API',
                    'Details' => curl_error($request),
                ];

                $this->closeRequest($request);

                return $data;
            }

            $this->closeRequest($request);

            $data = json_decode($response, true, 512, JSON_THROW_ON_ERROR);

            return $data;
        } catch (JsonException $e) {
            $this->closeRequest($request);
            return [
                'ErrorLevel' => 2,
                'ErrorCode' => 'SYSTEM_ERROR',
                'Error' => 'JSON error',
                'Details' => $e->getMessage(),
            ];
        } catch (Throwable $e) {
            $this->closeRequest($request);
            return [
                'ErrorLevel' => 2,
                'ErrorCode' => 'SYSTEM_ERROR',
                'Error' => 'Failed to send request',
                'Details' => $e->getMessage(),
            ];
        }
    }

    private function processOrderData(array $order): array
    {   
        $required = [
            'sender_address',
            'sender_city',
            'sender_postalcode',
            // sender_country is documented as required, but the example in spring.php does not include it and works without it
            //'sender_country',
            'delivery_fullname',
            'delivery_address',
            'delivery_city',
            'delivery_postalcode',
            'delivery_country',
        ];

        $missingFields = $this->validateRequiredFields($order, $required);
        if ($missingFields !== []) {
            $this->renderError('Invalid parameters', [
                'ErrorLevel' => 1,
                'ErrorCode' => 'MISSING_REQUIRED_FIELD',
                'Error' => 'Missing or empty parameters on $order: ' . implode(', ', $missingFields),
                'Params' => $order,
            ]);
        }

        $order['sender_address_lines'] = $this->splitAddressLines($order['sender_address']);
        $order['delivery_address_lines'] = $this->splitAddressLines($order['delivery_address']);

        return $order;
    }
    
    private function splitAddressLines(string $address, int $maxLen = 30): array
    {
        $address = trim(preg_replace('/\s+/', ' ', $address));
        $lines = [];
        $index = 1;

        while ($address !== '') {
            if (strlen($address) <= $maxLen) {
                $lines['AddressLine' . $index] = trim($address, ", \t\n\r\0\x0B");
                break;
            }

            $chunk = substr($address, 0, $maxLen);
            $lastCommaPos = strrpos($chunk, ',');

            if ($lastCommaPos !== false) {
                $part = substr($address, 0, $lastCommaPos + 1);
                $address = ltrim(substr($address, $lastCommaPos + 1));
            } else {
                $part = substr($address, 0, $maxLen);
                $address = ltrim(substr($address, $maxLen));
            }

            $lines['AddressLine' . $index] = rtrim($part, ', ');
            $index++;
        }

        return $lines;
    }


    private function validateParams(array $params): bool
    {
        $required = ['api_key', 'label_format', 'service', 'shipper_reference', 'shipment_value', 'weight'];
        $missingFields = $this->validateRequiredFields($params, $required);

        if ($missingFields !== []) {
            $this->renderError('Invalid parameters', [
                'ErrorLevel' => 1,
                'ErrorCode' => 'MISSING_REQUIRED_FIELD',
                'Error' => 'Missing or empty params: ' . implode(', ', $missingFields),
                'Params' => $params,
            ]);
            
            return false;
        }

        return true;
    }

    private function validateRequiredFields(array $data, $requiredFields): array
    {  
        $missingFields = [];

        foreach ($requiredFields as $key) {
            if (!isset($data[$key]) || $data[$key] === '') {
                $missingFields[] = $key;
            }
        }

        return $missingFields;
    }

    private function closeRequest($request): void
    {
        if ($request instanceof CurlHandle) {
            curl_close($request);
        }
    }

    private function assertApiSuccess(array $response, string $title): void
    {
        $errorLevel = (int) ($response['ErrorLevel'] ?? 1);

        if ($errorLevel === 0) {
            return;
        }

        $errorMessage = $this->buildApiErrorMessage($response);

        $this->renderError($title, array_merge($response, $errorMessage));
    }

    private function buildApiErrorMessage(array $response): array
    {
        $errorLevel = (int) ($response['ErrorLevel'] ?? 1);
        $errorCode = (string) ($response['ErrorCode'] ?? $response['Code'] ?? '');
        $apiMessage = (string) ($response['Error'] ?? $response['Message'] ?? 'Unknown error');

        $levelMap = [
            1 => [
                'Error' => 'VALIDATION_ERROR',
                'Solution' => 'Check data format and completeness',
            ],
            2 => [
                'Error' => 'SYSTEM_ERROR',
                'Solution' => 'Try again or contact technical support',
            ],
            3 => [
                'Error' => 'AUTH_ERROR',
                'Solution' => 'Check API key validity',
            ],
            4 => [
                'Error' => 'PERMISSION_ERROR',
                'Solution' => 'Contact administrator',
            ],
            5 => [
                'Error' => 'RATE_LIMIT_ERROR',
                'Solution' => 'Wait and try again',
            ],
        ];

        $validationMap = [
            'MISSING_REQUIRED_FIELD' => 'Add missing field according to documentation',
            'INVALID_SERVICE' => 'Use one of the supported services',
            'INVALID_COUNTRY' => 'Check list of supported countries for the service',
            'WEIGHT_LIMIT_EXCEEDED' => 'Reduce weight or choose different service',
            'FIELD_TOO_LONG' => 'Shorten text to limit for given service',
            'INVALID_FORMAT' => 'Check data format (e.g. country code, email)',
            'INVALID_PHONE' => 'Use only digits, no spaces or special characters',
            'INVALID_EMAIL' => 'Check email address validity',
            'INVALID_POSTCODE' => 'Check postal code format for given country',
            'MISSING_VALUE_FOR_SERVICE' => 'Add shipment value / product values if required for the service',
            'MISSING_HSCODE_FOR_INTERNATIONAL' => 'Add HS code to each product',
            'INVALID_HSCODE_LENGTH' => 'Use HS code with 6-10 digits',
        ];

        $data = $levelMap[$errorLevel] ?? [
            'Error' => 'API_ERROR',
            'Solution' => 'Check request and try again',
        ];

        if ($errorCode !== '' && isset($validationMap[$errorCode])) {
            $data['Solution'] = $validationMap[$errorCode];
        }

        $message = $data['Error'];

        if ($apiMessage !== '') {
            $message .= "      API message: " . $apiMessage;
        }

        return [
            'ErrorLevel' => $errorLevel,
            'ErrorCode' => $errorCode,
            'Error' => $message,
            'Solution' => $data['Solution'],
        ];
    }

    private function renderError(string $title, array $data): void
    {
        http_response_code(400);
        header('Content-Type: text/html; charset=utf-8');

        $msg = $data['Error'] ?? $data['error'] ?? 'Unknown error';

        echo '<h2>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h2>';
        echo '<p><strong>Error:</strong> ' . htmlspecialchars((string) $msg, ENT_QUOTES, 'UTF-8') . '</p>';

        echo '<pre style="white-space: pre-wrap;">' .
            htmlspecialchars(json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: '', ENT_QUOTES, 'UTF-8') .
            '</pre>';
        exit;
    }
}
