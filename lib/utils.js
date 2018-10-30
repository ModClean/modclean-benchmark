"use strict";
const moment = require('moment');
const humanize = require('humanize');
const si = require('systeminformation');
const table = require('markdown-table');

class BenchmarkUtils {
    formatNumber(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    
    getTime(time) {
        let diff = process.hrtime(time);
        return (diff[0] * 1e9 + diff[1]) / 1000000;
    }

    formatTime(secs) {
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
    
    async environment() {
        let env = [];
        
        try {
            let system = await si.system();
            env.push(system.model);
            
            let osinfo = await si.osInfo();
            env.push(`${osinfo.distro} ${osinfo.release}`);
            
            let cpu = await si.cpu();
            env.push(`${cpu.manufacturer} ${cpu.brand}`);
        } catch(err) {
            console.error('Error while getting system information:', err);
        }
        
        return env.join(' ');
    }
    
    async prepareResults(data) {
        let env = await this.environment();
        let res = {
            before: {
                files: this.formatNumber(data.before.files),
                dirs: this.formatNumber(data.before.dirs),
                size: humanize.filesize(data.before.size)
            },
            after: {
                files: this.formatNumber(data.after.files),
                dirs: this.formatNumber(data.after.dirs),
                size: humanize.filesize(data.after.size)
            },
            reduction: {
                files: this.formatNumber(data.before.files - data.after.files),
                dirs: this.formatNumber(data.before.dirs - data.after.dirs),
                size: humanize.filesize(data.before.size - data.after.size)
            },
            counts: {
                files: data.totals.files,
                dirs: data.totals.folders,
                empty: data.totals.empty,
                skipped: data.totals.skipped,
                modulesSkipped: data.skippedModules.length
            },
            times: {
                npm: this.formatTime(data.times.npm),
                modclean: this.formatTime(data.times.modclean),
                total: this.formatTime(data.times.total)
            },
            modules: data.modules.join(', '),
            patterns: data.patterns.join(', '),
            versions: data.versions,
            skippedModules: data.skippedModules,
            command: process.argv.join(' '),
            author: process.env.USER || 'Your Name',
            date: moment().format('M/D/YYYY'),
            environment: env
        };
        
        return res;
    }
    
    markdownTable(data, bold=true) {
        return table([
            ['', 'Total Files', 'Total Folders', 'Total Size'],
            [
                'Before ModClean',
                data.before.files,
                data.before.dirs,
                data.before.size
            ], [
                'After ModClean',
                data.after.files,
                data.after.dirs,
                data.after.size
            ], [
                'Reduction',
                bold? this.mdBold(data.reduction.files) : data.reduction.files,
                bold? this.mdBold(data.reduction.dirs) : data.reduction.dirs,
                bold? this.mdBold(data.reduction.size) : data.reduction.size
            ]
        ]);
    }
    
    mdBold(text) {
        return `**${text}**`;
    }
}

module.exports = BenchmarkUtils;
