#!/usr/bin/env node
"use strict";
const startTime = process.hrtime();

const program = require('commander');
const chalk = require('chalk');
const ora = require('ora');

const Benchmark = require('../lib/benchmark');

function list(val) {
    return val.split(',');
}

program
    .version(require('../package.json').version)
    .description('Benchmarking utility for ModClean 3.x')
    .usage('modclean-benchmark [options]')
    .option('-n, --patterns <patterns>', 'Patterns type(s) to remove (safe, caution, and/or danger)', list, 'default:safe')
    .option('-m, --modules <modules>', 'Modules to benchmark sepatated by commas', list, 'express,lodash,moment,async')
    .option('-a, --additional-patterns [list]', 'Additional glob patterns to search for', list)
    .option('-I, --ignore [list]', 'Comma separated list of patterns to ignore', list)
    .option('-s, --case-sensitive', 'Matches are case sensitive')
    .option('--no-dirs', 'Exclude directories from being removed')
    .option('--no-dotfiles', 'Exclude dot files from being removed')
    .option('-k, --keep-empty', 'Keep empty directories')
    .option('--no-clean', 'Skip cleanup process')
    .option('--no-log', 'Do not create log file at the end')
    .option('--name [name]', 'Custom benchmark test name', null)
    .option('--markdown', 'Display results as markdown (also applies to log)')
    .parse(process.argv);

console.log(
    "\n" + chalk.yellow.bold('MODCLEAN 3.x Benchmarking Utility') + "\n"
);

const benchmark = new Benchmark(program, startTime);

let spin = ora('');

async function run() {
    try {
        spin.start(`Creating test directory: ${benchmark.modulesDir}`);
        await benchmark.setupDir();
        spin.succeed();
        
        spin.start('Getting NPM Version...');
        await benchmark.getNPMVersion();
        spin.succeed();
        
        spin.start(`Installing modules: ${benchmark.modules.join(', ')}`);
        await benchmark.installModules();
        spin.succeed();
        
        spin.start('Gathering stats before ModClean...');
        await benchmark.getStats('before');
        spin.succeed();
        
        spin.start('Running ModClean...');
        await benchmark.runModclean();
        spin.succeed();
        
        spin.start('Gathering stats after ModClean...');
        await benchmark.getStats('after');
        spin.succeed();
        
        if(program.clean) {
            spin.start('Cleaning up...');
            let res = await benchmark.cleanup();
            if(!res) spin.warn('Unable to clean up files, please clean up manually');
            else spin.succeed();
        }
        
        await benchmark.display(program.markdown? 'markdown' : 'cli');
        
        process.exit(0);
    } catch(err) {
        if(spin.isSpinning) spin.fail();
        console.error(err);
        
        process.exit(1);
    }
}

run();
