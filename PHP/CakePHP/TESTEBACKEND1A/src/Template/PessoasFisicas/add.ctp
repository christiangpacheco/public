<?php
/**
 * @var \App\View\AppView $this
 * @var \App\Model\Entity\PessoasFisica $pessoasFisica
 */
?>
<nav class="large-3 medium-4 columns" id="actions-sidebar">
    <ul class="side-nav">
        <li class="heading"><?= __('Actions') ?></li>
        <li><?= $this->Html->link(__('List Pessoas Fisicas'), ['action' => 'index']) ?></li>
    </ul>
</nav>
<div class="pessoasFisicas form large-9 medium-8 columns content">
    <?= $this->Form->create($pessoasFisica) ?>
    <fieldset>
        <legend><?= __('Add Pessoas Fisica') ?></legend>
        <?php
            $this->Form->templates(
            ['dateWidget' => '{{day}}{{month}}{{year}}']
            );
            echo $this->Form->control('nome');
            echo $this->Form->control('cpf');
            ?>
           <div>
                <label for="diaa">Data de Nascimento:</label>
                <input type="date" id="data_nasc" name="data_nasc">
            </div>
        
    </fieldset>
    <?= $this->Form->button(__('Submit')) ?>
    <?= $this->Form->end() ?>
</div>
