#!/usr/bin/env node
require('colors');

var program  = require('commander'),
    path     = require('path'),
    async    = require('async'),
    fs       = require('fs-extra'),
    du       = require('du'),
    dir      = require('node-dir'),
    modclean = require('modclean'),
    ModClean = modclean.ModClean,
    Spinner  = require('cli-spinner').Spinner,
    Table    = require('cli-table'),
    humanize = require('humanize'),
    moment   = require('moment');
    
program
    .version(require('../package.json').version)
    .description('Benchmarking utility for ModClean')
    .usage('modclean-benchmark [options]')
    .option('-n, --patterns [patterns]', 'Patterns type(s) to remove (safe, caution, and/or danger)')
    .option('-m, --modules [modules]', 'Modules to benchmark sepatated by commas')
    .option('-c, --no-clean', 'Skip cleanup process')
    .parse(process.argv);

console.log('ModClean Benchmarking Utility'.yellow.bold, "\n");
var totalTime = process.hrtime();

var bmDir = 'mc-benchmark-'+ Date.now(),
    patterns = typeof program.patterns === 'string' && program.patterns? program.patterns.split(',') : ['safe'],
    benchmark = {
        modules: (!program.modules || typeof program.modules === 'boolean')? 
                    ['express', 'lodash', 'moment', 'async'] : program.modules.split(','),
        patterns: [],
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
    },
    spin;

if(Array.isArray(patterns)) {
    patterns.forEach(function(pat) {
        if(modclean.patterns.hasOwnProperty(pat))
            benchmark.patterns.push(modclean.patterns[pat]);
    });
}

if(!benchmark.patterns.length)
    benchmark.patterns.push(modclean.patterns.safe);

async.series([
    // Benchmark setup
    function setup(cb) {
        fs.mkdirp('./'+ bmDir +'/node_modules', function(err) {
            if(err) return cb('Error while creating directory:\n'+ err);
            
            log(('Installing modules to ./'+ bmDir +'/node_modules').grey);
            process.chdir('./'+ bmDir);
            cb();
        });
    },
    
    // Install Modules
    function installModules(cb) {
        var npm = require('npm'),
            npmTime = process.hrtime();
        spin = new Spinner('%s'.cyan.bold + ' Installing Modules, please wait...'.grey);
        
        npm.load(function(err) {
            if(err) return cb('Error while loading NPM:\n' + err);
            log('Installing modules'.grey, benchmark.modules.join(', '));
            spin.start();
            
            npm.commands.install(benchmark.modules, function(err, data) {
                console.log("\n");
                if(err) return cb('Error while installing modules:\n' + err);
                spin.stop(true);
                benchmark.times.npm = getTime(npmTime);
                benchmark.npm = data;
                
                if(Array.isArray(data)) {
                    var mods = {
                        main: [],
                        deps: []
                    };
                    
                    data.forEach(function(mod) {
                        if(!mod[2]) mods.main.push(mod[0]);
                        else mods.deps.push(mod[0]);
                    });
                    
                    benchmark.mods = mods;
                }
                cb();
            });
        });
    },
    
    // Get stats before ModClean runs
    function benchmarkBefore(cb) {
        spin = new Spinner('%s'.cyan.bold + ' Getting stats...'.grey);
        
        getStats(function(stats) {
            benchmark.before = stats;
            spin.stop(true);
            cb();
        });
    },
    
    function runModClean(cb) {
        console.log("\n");
        spin = new Spinner('%s'.cyan.bold + ' Running ModClean, please wait...'.grey);
        var mcTime = process.hrtime();
        
        var MC = new ModClean({
            cwd: process.cwd(),
            patterns: benchmark.patterns
        });
        
        MC.on('files', function(files) {
            log('Found'.grey, files.length.toString().green.bold, 'files/folders to remove.'.grey);
            benchmark.files = files;
            spin.start();
        });
        
        MC.clean(function(err, results) {
            if(err) return cb('Error while running ModClean\n'+ err);
            spin.stop(true);
            benchmark.times.modclean = getTime(mcTime);
            
            cb();
        });
    },
    
    // Get stats after ModClean runs
    function benchmarkBefore(cb) {
        spin = new Spinner('%s'.cyan.bold + ' Getting stats...'.grey);
        
        getStats(function(stats) {
            benchmark.after = stats;
            spin.stop(true);
            cb();
        });
    },
    
    // Cleanup modules
    function cleanup(cb) {
        process.chdir('../');
        if(program.noClean) return cb();
        
        spin = new Spinner('%s'.cyan.bold + ' Cleaning up, please wait...'.grey);
        spin.start();
        
        fs.remove('./'+ bmDir, function(err) {
            spin.stop(true);
            if(err) error('Unable to cleanup files installed, please cleanup manually');
            cb();
        });
    },
    
    // Display the results
    function displayResults(cb) {
        console.log("\n");
        log('Results for', ('npm install '+ benchmark.modules.join(' ')).grey, 'using patterns', patterns.join(', ').grey);
        
        var table = new Table({
            head: ['', 'Total Files', 'Total Folders', 'Total Size'],
            style: {
                head: ['yellow', 'bold']
            }
        });
        
        table.push({
            'Before ModClean': [
                formatNumber(benchmark.before.files),
                formatNumber(benchmark.before.dirs),
                humanize.filesize(benchmark.before.size)
            ]
        }, {
            'After ModClean': [
                formatNumber(benchmark.after.files),
                formatNumber(benchmark.after.dirs),
                humanize.filesize(benchmark.after.size)
            ]
        }, {
            'Reduced': [
                formatNumber(benchmark.before.files - benchmark.after.files),
                formatNumber(benchmark.before.dirs - benchmark.after.dirs),
                humanize.filesize(benchmark.before.size - benchmark.after.size)
            ]
        });
        
        var tbl = table.toString();
        
        console.log(tbl, "\n");
        benchmark.times.total = getTime(totalTime);
        
        console.log('NPM Install Time:'.yellow.bold, formatTime(benchmark.times.npm));
        console.log('ModClean Time:   '.yellow.bold, formatTime(benchmark.times.modclean));
        console.log('Total Time:      '.yellow.bold, formatTime(benchmark.times.total));
        
        var logTable = new Table({
            head: ['', 'Result']
        });
        
        logTable.push({
            'Modules': [benchmark.modules.join(', ')]
        }, {
            'Installed Modules': [benchmark.mods.main.join(', ')]
        }, {
            'Dependencies': [benchmark.mods.deps.join(', ')]
        }, {
            'Patterns': [benchmark.patterns.join(', ')]
        }, {
            'ModClean Removed': [formatNumber(benchmark.files.length)]
        }, {
            'Total Removed': [formatNumber((benchmark.before.files - benchmark.after.files) + (benchmark.before.dirs - benchmark.after.dirs))]
        }, {
            'NPM Install Time': [formatTime(benchmark.times.npm)]
        }, {
            'ModClean Time': [formatTime(benchmark.times.modclean)]
        }, {
            'Total Time': [formatTime(benchmark.times.total)]
        });
        
        var logFile = [
            tbl.replace(/\u001b\[(?:\d*;){0,5}\d*m/g, ''),
            "\n",
            logTable.toString().replace(/\u001b\[(?:\d*;){0,5}\d*m/g, ''),
            "\n",
            'RAW DATA:',
            '-----------------------------------------------------------------------------------',
            JSON.stringify(benchmark, null, 4)
        ];
        
        fs.outputFile('./'+ bmDir +'.log', logFile.join("\n"), function(err) {
            console.log("\n");
            if(err) error('Unable to write log file');
            else log('Log file written to', ('./'+ bmDir +'.log').grey);
            cb();
        });
    }
], function(err) {
    if(err) {
        if(spin) spin.stop(true);
        error(err);
        return process.exit(1);
    }
    
    process.exit(0);
});

////////////////////////////////////////////////
/// UTILITY FUNCTIONS                         //
////////////////////////////////////////////////

function getStats(cb) {
    var fp = path.join('./node_modules'),
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

function log() {
    var args = Array.prototype.slice.call(arguments, 0);
    args.unshift(' \u25BA '.cyan.bold);
    console.log.apply(console, args);
}

function error() {
    var args = Array.prototype.slice.call(arguments, 0);
    args.unshift(' X '.red.bold);
    console.error.apply(console, args);
}

function formatNumber(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getTime(time) {
    var diff = process.hrtime(time);
    return (diff[0] * 1e9 + diff[1]) / 1000000;
}

function formatTime(secs) {
    if(typeof secs !== 'number') return 'Not Available';
    
    var d = moment.duration(secs, 'milliseconds'),
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
    
    out.push(hours + ' hour' + (hours<1||hours>1? 's' : ''));
    out.push(mins + ' minute' + (mins<1||mins>1? 's' : ''));
    out.push(seconds + ' second' + (seconds<1||seconds>1? 's' : ''));
    
    return out.join(', ');
}
