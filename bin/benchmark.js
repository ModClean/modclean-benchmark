#!/usr/bin/env node
"use strict";
let startTime = process.hrtime();

const program  = require('commander');
const path     = require('path');
const async    = require('async');
const chalk    = require('chalk');
const fs       = require('fs-extra');
const du       = require('du');
const dir      = require('node-dir');
const modclean = require('modclean');
const ModClean = modclean.ModClean;
const ora      = require('ora');
const Table    = require('cli-table2');
const humanize = require('humanize');
const moment   = require('moment');
const DevNull  = require('dev-null');

function list(val) {
    return val.split(',');
}

program
    .version(require('../package.json').version)
    .description('Benchmarking utility for ModClean 2.x')
    .usage('modclean-benchmark [options]')
    .option('-n, --patterns <patterns>', 'Patterns type(s) to remove (safe, caution, and/or danger)', list)
    .option('-m, --modules <modules>', 'Modules to benchmark sepatated by commas', list)
    .option('-a, --additional-patterns <list>', 'Additional glob patterns to search for', list)
    .option('-I, --ignore <list>', 'Comma separated list of patterns to ignore', list)
    .option('-s, --case-sensitive', 'Matches are case sensitive')
    .option('--no-dirs', 'Exclude directories from being removed')
    .option('--no-dotfiles', 'Exclude dot files from being removed')
    .option('-k, --keep-empty', 'Keep empty directories')
    .option('--no-clean', 'Skip cleanup process')
    .option('--no-log', 'Do not create log file at the end')
    .parse(process.argv);

console.log(
    "\n" + chalk.yellow.bold('MODCLEAN 2.x Benchmarking Utility') + "\n"
);

let spin = ora('');
    spin.color = 'cyan';

class ModClean_Benchmark {
    constructor() {
        this.testName = 'mc-benchmark-'+ Date.now();
        this.modules = Array.isArray(program.modules) && program.modules.length? program.modules : ['express', 'lodash', 'moment', 'async'];
        this.patterns = Array.isArray(program.patterns) && program.patterns.length? program.patterns : ['default:safe'];
        
        this.info = {
            files: [],
            before: {},
            after: {},
            npm: [],
            mods: {},
            times: {
                total: 0,
                modclean: 0,
                npm: 0
            }
        };
        
        this.start();
    }
    
    start() {
        let self = this;
        
        async.series([
            this.setup.bind(this),
            this.installModules.bind(this),
            
            function benchmarkBefore(cb) {
                spin.text = chalk.gray('Getting stats...');
                spin.start();
                
                self.getStats((stats) => {
                    self.info.before = stats;
                    spin.succeed();
                    cb();
                });
            },
            
            this.runModclean.bind(this),
            
            function benchmarkAfter(cb) {
                spin.text = chalk.gray('Getting updated stats...');
                spin.start();
                
                self.getStats((stats) => {
                    self.info.after = stats;
                    spin.succeed();
                    cb();
                });
            },
            
            this.cleanup.bind(this),
            this.displayResults.bind(this)
        ], (err) => {
            if(err) {
                if(spin) spin.fail();
                error(err);
                return process.exit(1);
            }
            
            process.exit(0);
        });
    }
    
    setup(cb) {
        fs.mkdirp(`./${this.testName}/node_modules`, (err) => {
            if(err) return cb('Error while creating directory:\n'+ err);
            
            log(chalk.gray(`Installing modules to ./${this.testName}/node_modules`));
            process.chdir('./' + this.testName);
            cb();
        });
    }
    
    installModules(cb) {
        let npm = require('npm'),
            npmTime = process.hrtime();
        
        log(chalk.gray('Installing modules'), this.modules.join(', '));
        
        spin.text = chalk.gray('Installing Modules...');
        
        npm.load({ loglevel: "silent", progress: false, logstream: new DevNull() }, (err) => {
            if(err) return cb('Error while loading NPM:\n' + err);
            spin.start();
            
            npm.commands.install(this.modules, (err, data) => {
                console.log("\n");
                if(err) return cb('Error while installing modules:\n' + err);
                spin.succeed();
                
                this.info.times.npm = getTime(npmTime);
                this.info.npm = data;
                
                if(Array.isArray(data)) {
                    let mods = {
                        main: [],
                        deps: []
                    };
                    
                    data.forEach(function(mod) {
                        if(!mod[2]) mods.main.push(mod[0]);
                        else mods.deps.push(mod[0]);
                    });
                    
                    this.info.mods = mods;
                }
                cb();
            });
        });
    }
    
    runModclean(cb) {
        console.log("\n");
        spin.text = chalk.gray('Starting ModClean...');
        spin.start();
        
        let mcTime = process.hrtime();
        
        var MC = new ModClean({
            cwd: process.cwd(),
            patterns: this.patterns,
            additionalPatterns: program.additionalPatterns || [],
            ignorePatterns: program.ignore || [],
            noDirs: !program.dirs,
            dotFiles: !!program.dotfiles,
            removeEmptyDirs: !program.keepEmpty,
            ignoreCase: !program.caseSensitive,
        });
        
        MC.on('files', (files) => {
            spin.succeed();
            log('Found', chalk.green.bold(files.length), 'files/folders to remove.');
            
            this.info.files = files;
            
            spin.text = chalk.gray('Running ModClean...');
            spin.start();
        });
        
        MC.clean((err, results) => {
            if(err) return cb('Error while running ModClean\n'+ err);
            spin.succeed();
            
            this.info.times.modclean = getTime(mcTime);
            
            cb();
        });
    }
    
    cleanup(cb) {
        process.chdir('../');
        if(!program.clean) return cb();
        
        spin.text = chalk.gray('Cleaning up...');
        spin.start();
        
        fs.remove('./'+ this.testName, (err) => {
            if(err) {
                spin.fail();
                error('Unable to cleanup files installed, please cleanup manually');
                return cb();
            }
            
            spin.succeed();
            cb();
        });
    }
    
    displayResults(cb) {
        console.log("\n");
        log(`Results for ${chalk.gray('npm install '+ this.modules.join(' '))} using patterns ${chalk.gray(this.patterns.join(', '))}`);
        
        let table = new Table({
            head: ['', 'Total Files', 'Total Folders', 'Total Size'],
            style: {
                head: ['yellow', 'bold']
            }
        });
        
        table.push({
            'Before ModClean': [
                formatNumber(this.info.before.files),
                formatNumber(this.info.before.dirs),
                humanize.filesize(this.info.before.size)
            ]
        }, {
            'After ModClean': [
                formatNumber(this.info.after.files),
                formatNumber(this.info.after.dirs),
                humanize.filesize(this.info.after.size)
            ]
        }, {
            'Reduced': [
                formatNumber(this.info.before.files - this.info.after.files),
                formatNumber(this.info.before.dirs - this.info.after.dirs),
                humanize.filesize(this.info.before.size - this.info.after.size)
            ]
        });
        
        let tbl = table.toString();
        
        console.log(tbl, "\n");
        this.info.times.total = getTime(startTime);
        
        console.log(chalk.yellow.bold('NPM Install Time:'), formatTime(this.info.times.npm));
        console.log(chalk.yellow.bold('ModClean Time:   '), formatTime(this.info.times.modclean));
        console.log(chalk.yellow.bold('Total Time:      '), formatTime(this.info.times.total));
        
        if(!program.log) return cb();
        
        let logTable = new Table({
            head: ['', 'Result']
        });
        
        logTable.push({
            'Modules': [this.modules.join(', ')]
        }, {
            'Patterns': [this.patterns.join(', ')]
        }, {
            'ModClean Removed': [formatNumber(this.info.files.length)]
        }, {
            'Total Removed': [formatNumber((this.info.before.files - this.info.after.files) + (this.info.before.dirs - this.info.after.dirs))]
        }, {
            'NPM Install Time': [formatTime(this.info.times.npm)]
        }, {
            'ModClean Time': [formatTime(this.info.times.modclean)]
        }, {
            'Total Time': [formatTime(this.info.times.total)]
        });
        
        let logFile = [
            tbl.replace(/\u001b\[(?:\d*;){0,5}\d*m/g, ''),
            "\n",
            logTable.toString().replace(/\u001b\[(?:\d*;){0,5}\d*m/g, ''),
            "\n",
            JSON.stringify(this.info, null, 4)
        ];
        
        fs.outputFile('./'+ this.testName +'.log', logFile.join("\n"), (err) => {
            console.log("\n");
            if(err) error('Unable to write log file');
            else log('Log file written to', chalk.gray('./'+ this.testName +'.log'));
            cb();
        });
    }
    
    getStats(cb) {
        let fp = path.join('./node_modules'),
            stats = {
                files: 0,
                dirs: 0,
                size: 0
            };
        
        dir.files(fp, function(err, files) {
            if(err) error('Error while getting file stats:\n', err);
            else stats.files = files.length;
            
            dir.subdirs(fp, function(err, dirs) {
                if(err) error('Error while getting directory stats:\n', err);
                else stats.dirs = dirs.length;
                
                du(fp, function(err, size) {
                    if(err) error('Error while getting directory stats:\n', err);
                    else stats.size = size;
                    
                    cb(stats);
                });
            });
        });
    }
}

new ModClean_Benchmark();

////////////////////////////////////////////////
/// UTILITY FUNCTIONS                         //
////////////////////////////////////////////////

function log(...args) {
    args.unshift(chalk.cyan.bold(' \u25BA '));
    console.log.apply(console, args);
}

function error(...args) {
    args.unshift(chalk.red.bold(' X '));
    console.error.apply(console, args);
}

function formatNumber(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getTime(time) {
    let diff = process.hrtime(time);
    return (diff[0] * 1e9 + diff[1]) / 1000000;
}

function formatTime(secs) {
    if(typeof secs !== 'number') return 'Not Available';
    
    let d = moment.duration(secs, 'milliseconds'),
        years = d.years(),
        months = d.months(),
        days = d.days(),
        hours = d.hours(),
        mins = d.minutes(),
        seconds = d.seconds(),
        out = [];
    
    if(years > 0) out.push(years + ' year' + (years>1? 's' : ''));
    if(months > 0) out.push(months + ' month' + (months>1? 's' : ''));
    if(days > 0) out.push(days + ' day' + (days>1? 's' : ''));
    if(hours > 0) out.push(hours + ' hour' + (hours>1? 's' : ''));
    
    out.push(mins + ' minute' + (mins<1||mins>1? 's' : ''));
    out.push(seconds + ' second' + (seconds<1||seconds>1? 's' : ''));
    
    return out.join(', ');
}
