<?php
/**
 * @var \App\View\AppView $this
 * @var \App\Model\Entity\PessoasFisica $pessoasFisica
 */
?>
<nav class="large-3 medium-4 columns" id="actions-sidebar">
    <ul class="side-nav">
        <li class="heading"><?= __('Actions') ?></li>
        <li><?= $this->Html->link(__('Edit Pessoas Fisica'), ['action' => 'edit', $pessoasFisica->id]) ?> </li>
        <li><?= $this->Form->postLink(__('Delete Pessoas Fisica'), ['action' => 'delete', $pessoasFisica->id], ['confirm' => __('Are you sure you want to delete # {0}?', $pessoasFisica->id)]) ?> </li>
        <li><?= $this->Html->link(__('List Pessoas Fisicas'), ['action' => 'index']) ?> </li>
        <li><?= $this->Html->link(__('New Pessoas Fisica'), ['action' => 'add']) ?> </li>
    </ul>
</nav>
<div class="pessoasFisicas view large-9 medium-8 columns content">
    <h3><?= h($pessoasFisica->id) ?></h3>
    <table class="vertical-table">
        <tr>
            <th scope="row"><?= __('Nome') ?></th>
            <td><?= h($pessoasFisica->nome) ?></td>
        </tr>
        <tr>
            <th scope="row"><?= __('Cpf') ?></th>
            <td><?= h($pessoasFisica->cpf) ?></td>
        </tr>
        <tr>
            <th scope="row"><?= __('Id') ?></th>
            <td><?= $this->Number->format($pessoasFisica->id) ?></td>
        </tr>
        <tr>
            <th scope="row"><?= __('Data Nasc') ?></th>
            <td><?= h($pessoasFisica->data_nasc) ?></td>
        </tr>
    </table>
</div>
