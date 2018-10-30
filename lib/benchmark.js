"use strict";

const util = require('util');

const path = require('path');
const fs = require('fs-extra');
const du = util.promisify(require('du'));
const dir = require('node-dir');
const chalk = require('chalk');
const modclean = require('modclean');
const on = require('await-handler');
const cp = require('child_process');
const stripAnsi = require('strip-ansi');

const BenchmarkUtils = require('./utils');

const dirFiles = util.promisify(dir.files);
const dirSubdirs = util.promisify(dir.subdirs);

class Benchmark extends BenchmarkUtils {
    constructor(opts, startTime) {
        super();
        this.opts = opts;
        this.startTime = startTime || process.hrtime();
        
        this.testName = opts.name || 'mc-benchmark-'+ Date.now();
        this.modules = Array.isArray(opts.modules) && opts.modules.length? opts.modules : ['express', 'lodash', 'moment', 'async'];
        this.patterns = Array.isArray(opts.patterns) && opts.patterns.length? opts.patterns : ['default:safe'];
        
        this.modulesDir = `./${this.testName}/node_modules`;
        this.testDir = `./${this.testName}`;
        
        this.info = {
            testName: this.testName,
            modules: this.modules,
            patterns: this.patterns,
            totals: {
                files: 0,
                folders: 0,
                empty: 0,
                skipped: 0
            },
            skippedModules: [],
            before: {},
            after: {},
            versions: {
                npm: null,
                node: process.version.replace(/^v/, ''),
                modclean: modclean.version
            },
            npmVersion: null,
            times: {
                total: 0,
                modclean: 0,
                npm: 0
            }
        };
    }
    
    async setupDir() {
        let [err] = await on(fs.mkdirp(this.modulesDir));
        if(err) throw err;
        
        process.chdir(this.testDir);
    }
    
    async execNPM(args) {
        let execFile = util.promisify(cp.execFile);
        let options = {
            cwd: process.cwd()
        };
        
        return await execFile('npm', args, options);
    }
    
    async getNPMVersion() {
        let { stdout } = await this.execNPM(['-v']);
        this.info.versions.npm = (stdout || 'Unknown').trim();
        return stdout;
    }
    
    async installModules() {
        let npmTime = process.hrtime();
        
        let [err] = await on(this.execNPM(['install'].concat(this.modules)));
        if(err) throw err;
        
        this.info.times.npm = this.getTime(npmTime);
        return true;
    }
    
    async runModclean() {
        let mcTime = process.hrtime();
        
        let mc = modclean({
            cwd: process.cwd(),
            patterns: this.patterns,
            additionalPatterns: this.opts.additionalPatterns || [],
            ignorePatterns: this.opts.ignore || [],
            noDirs: !this.opts.dirs,
            dotFiles: !!this.opts.dotfiles,
            removeEmptyDirs: !this.opts.keepEmpty,
            ignoreCase: !this.opts.caseSensitive
        });
        
        mc.on('file:list', (files) => {
            let dirs = files.filter(file => file.isDirectory).length;
            
            this.info.totals.files = Math.abs(files.length - dirs);
            this.info.totals.folders = dirs;
        });
        
        mc.on('emptydir:list', (empty) => {
            this.info.totals.empty = empty.length;
        });
        
        mc.on('file:skipped', (file) => {
            this.info.totals.skipped += 1;
            if(file.isModule) this.info.skippedModules.push(file.name);
        });
        
        await mc.clean();
        this.info.times.modclean = this.getTime(mcTime);
        
        return true;
    }
    
    async cleanup() {
        if(!this.opts.clean) return false;
        process.chdir('../');
        
        let [err] = await on(fs.remove(this.testDir));
        if(err) return false;
        
        return true;
    }
    
    async display(type='cli') {
        this.info.times.total = this.getTime(this.startTime);
        let data = await this.prepareResults(this.info),
            result;
        
        console.log('\n\n');
        
        switch(type) {
            case 'cli':
                result = this.displayCLI(data);
                break;
            case 'markdown':
                result = this.displayMarkdown(data);
                break;
            default:
                throw new Error('Invalid display type. Must be "cli" or "markdown".');
        }
        
        console.log(result);
        
        if(!this.opts.log) return result;
        console.log('\n\n');
        
        let logFile = `./${this.testName}-result.md`;
        let [err] = await on(fs.outputFile(logFile, stripAnsi(result)));
        if(err) console.error('Unable to write log file');
        else console.log(`Log file written to: ${logFile}`);
        
        return true;
    }
    
    displayCLI(data) {
        let output = [
            this.markdownTable(data, false) + '\n',
            chalk.green.bold('Full Statistics'),
            chalk.blue('Files Removed:    ') + data.counts.files,
            chalk.blue('Folders Removed:  ') + data.counts.dirs,
            chalk.blue('Empty Folders:    ') + data.counts.empty,
            chalk.blue('Skipped Files:    ') + data.counts.skipped,
            chalk.blue('Modules Skipped:  ') + data.counts.modulesSkipped + ' - ' + chalk.gray(data.skippedModules.join(', ')),
            chalk.gray('-'.repeat(process.stdout.columns - 1)),
            chalk.blue('Modules:          ') + data.modules,
            chalk.blue('Patterns:         ') + data.patterns,
            chalk.gray('-'.repeat(process.stdout.columns - 1)),
            chalk.blue('NPM Version:      ') + data.versions.npm,
            chalk.blue('Node Version:     ') + data.versions.node,
            chalk.blue('ModClean Version: ') + data.versions.modclean,
            '\n',
            chalk.green.bold('Completion Times'),
            chalk.blue('NPM Install:      ') + data.times.npm,
            chalk.blue('ModClean Run:     ') + data.times.modclean,
            chalk.blue('Total Time:       ') + data.times.total,
            '\n'
        ];
        
        return output.join('\n');
    }
    
    displayMarkdown(data) {
        let output = [
            '```bash',
            `modclean-benchmark -m ${data.modules.replace(/ /g, '')} --patterns="${data.patterns.replace(/ /g, '')}"`,
            '```\n',
            this.markdownTable(data) + '\n',
            '<details>',
            '<summary>Additional Stats</summary>\n',
            '<br>\n',
            '```',
            `Modules:         ${data.modules}`,
            `Patterns:        ${data.patterns}`,
            `Files Removed:   ${data.counts.files}`,
            `Folders Removed: ${data.counts.dirs}`,
            `Empty Folders:   ${data.counts.empty}`,
            `Skipped Files:   ${data.counts.skipped}`,
            `Modules Skipped: ${data.counts.modulesSkipped}`,
            `                 ${data.skippedModules.join(', ')}`,
            `Times:`,
            `       NPM Install:  ${data.times.npm}`,
            `       ModClean Run: ${data.times.modclean}`,
            `       Total Time:   ${data.times.total}`,
            '```\n',
            '</details>\n',
            `> **Author:** ${data.author}  `,
            `> **Last Updated:** ${data.date}  `,
            `> **Environment:** ${data.environment}  `,
            `> **Versions:** ModClean ${data.versions.modclean}, Node ${data.versions.node}, NPM ${data.versions.npm}`
        ];
        
        return output.join('\n');
    }
    
    async getStats(key) {
        let fp = path.join('./node_modules'),
            stats = {
                files: 0,
                dirs: 0,
                size: 0
            };
        
        try {
            let files = await dirFiles(fp);
            stats.files = files.length;
            
            let dirs = await dirSubdirs(fp);
            stats.dirs = dirs.length;
            
            let size = await du(fp);
            stats.size = size;
        } catch(err) {
            throw err;
        }
        
        this.info[key] = stats;
        return stats;
    }
}

module.exports = Benchmark;
