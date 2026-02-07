<?php
namespace App\Test\TestCase\Model\Table;

use App\Model\Table\PessoasFisicasTable;
use Cake\ORM\TableRegistry;
use Cake\TestSuite\TestCase;

/**
 * App\Model\Table\PessoasFisicasTable Test Case
 */
class PessoasFisicasTableTest extends TestCase
{
    /**
     * Test subject
     *
     * @var \App\Model\Table\PessoasFisicasTable
     */
    public $PessoasFisicas;

    /**
     * Fixtures
     *
     * @var array
     */
    public $fixtures = [
        'app.PessoasFisicas',
    ];

    /**
     * setUp method
     *
     * @return void
     */
    public function setUp()
    {
        parent::setUp();
        $config = TableRegistry::getTableLocator()->exists('PessoasFisicas') ? [] : ['className' => PessoasFisicasTable::class];
        $this->PessoasFisicas = TableRegistry::getTableLocator()->get('PessoasFisicas', $config);
    }

    /**
     * tearDown method
     *
     * @return void
     */
    public function tearDown()
    {
        unset($this->PessoasFisicas);

        parent::tearDown();
    }

    /**
     * Test initialize method
     *
     * @return void
     */
    public function testInitialize()
    {
        $this->markTestIncomplete('Not implemented yet.');
    }

    /**
     * Test validationDefault method
     *
     * @return void
     */
    public function testValidationDefault()
    {
        $this->markTestIncomplete('Not implemented yet.');
    }
}
