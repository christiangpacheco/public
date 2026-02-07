<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/Courier.php';

$order = [
    'sender_company' => 'BaseLinker',
    'sender_fullname' => 'Jan Kowalski',
    'sender_address' => 'Kopernika 10',
    'sender_city' => 'Gdansk',
    'sender_postalcode' => '80208',
    'sender_email' => '',
    'sender_phone' => '666666666',

    'delivery_company' => 'Spring GDS',
    'delivery_fullname' => 'Maud Driant',
    'delivery_address' => 'Strada Foisorului, Nr. 16, Bl. F11C, Sc. 1, Ap. 10',
    'delivery_city' => 'Bucuresti, Sector 3',
    'delivery_postalcode' => '031179',
    'delivery_country' => 'RO',
    'delivery_email' => 'john@doe.com',
    'delivery_phone' => '555555555',
];

$params = [
    'api_key' => 'T4sdZxM9iRHYqTBC1Lxh',
    'label_format' => 'PDF',
    'service' => 'PPTT',
    'shipper_reference' => 'ORDER-12345',
    'shipment_value' => 10.0,
    "weight" => 1.0,
];

$courier = new Courier();
$tracking = $courier->newPackage($order, $params);
$courier->packagePDF($tracking);