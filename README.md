# ModClean Benchmark Utility
[![npm version](https://img.shields.io/npm/v/modclean-benchmark.svg)](https://www.npmjs.com/package/modclean-benchmark) ![NPM Dependencies](https://david-dm.org/KyleRoss/modclean-benchmark.svg) [![NPM Downloads](https://img.shields.io/npm/dm/modclean-benchmark.svg)](https://www.npmjs.com/package/modclean-benchmark) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/KyleRoss/modclean-benchmark/master/LICENSE) [![GitHub issues](https://img.shields.io/github/issues/KyleRoss/modclean-benchmark.svg)](https://github.com/KyleRoss/modclean-benchmark/issues) [![Greenkeeper badge](https://badges.greenkeeper.io/ModClean/modclean-benchmark.svg)](https://greenkeeper.io/)

Quickly run a benchmark test for [ModClean](https://github.com/ModClean/modclean). I started to get tired of manually running benchmark tests, so I threw together this small Node script that does it for you.

Note that version `2.0.0` is for ModClean 2.x, if you want to benchmark the old version, use version `1.0.0` of this module.

## Install

    npm install modclean-benchmark -g


## Usage
Once installed globally, you will have access to `modclean-benchmark` through command line.

    modclean-benchmark [options]


### Options
These are the available flags/options for `modclean-benchmark`.

#### -n, --patterns [patterns]
Specify which pattern plugins/rules to use. Separate multiple groups by a single comma (no spaces). Default is `default:safe`. 
Example: `modclean-benchmark -n default:safe,default:caution`

#### -m, --modules [modules]
Specify which npm modules to use for the benchmark. Multiple modules should be separated by a single comma (no spaces). Default is `express,lodash,moment,async`.
Example: `modclean-benchmark -m express,underscore,numeral,fs-extra`

#### -a, --additional-patterns [patterns]
Specify additional custom glob patterns to use along with the patterns that are loaded from `-n`.  
Example: `modclean-benchmark --additional-patterns="*.html,contributing*"`

#### -I, --ignore [patterns]
Specify glob patterns to ignore while searching for files. Useful if a prexisting pattern matches a module name you do not want removed.  
Example: `modclean-benchmark --ignore="npm-license-lookup"`

#### -s, --case-sensitive
Enable case sensitive checking when locating files based on the patterns.

#### --no-dirs
Disable removal of directories.

#### --no-dotfiles
Exclude dot files from being removed.

#### -k, --keep-empty
Prevents removal of empty directories.

#### --no-log
Do not create a log file when the process is complete.

#### --no-clean
Turn off post-modclean cleanup process. By default, this script will cleanup the modules downloaded from npm after the process is complete and the benchmarks are ran, if you would rather keep the files, use this flag.

## Submitting Benchmarks
Feel free to submit benchmark results in the proper format in the [ModClean repository](https://github.com/ModClean/modclean) by creating a pull request.

## License
Licensed under the MIT License. See `LICENSE` in the repository for the full text.
