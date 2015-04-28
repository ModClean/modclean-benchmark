# ModClean Benchmark Utility
[![npm version](https://img.shields.io/npm/v/modclean-benchmark.svg)](https://www.npmjs.com/package/modclean-benchmark) ![NPM Dependencies](https://david-dm.org/KyleRoss/modclean-benchmark.svg) [![NPM Downloads](https://img.shields.io/npm/dm/modclean-benchmark.svg)](https://www.npmjs.com/package/modclean-benchmark) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/KyleRoss/modclean-benchmark/master/LICENSE) [![GitHub issues](https://img.shields.io/github/issues/KyleRoss/modclean-benchmark.svg)](https://github.com/KyleRoss/modclean-benchmark/issues)

Quickly run a benchmark test for [ModClean](https://github.com/KyleRoss/modclean). I started to get tired of manually running benchmark tests, so I threw together this small Node script that does it for you.

## Install

    npm install modclean-benchmark -g


## Usage
Once installed globally, you will have access to `modclean-benchmark` through command line.

    modclean-benchmark [options]


### Options
These are the available flags/options for `modclean-benchmark`.

#### -n, --patterns [patterns]
Specify which group(s) of patterns to use. Can be `safe`, `caution` or `danger`. Separate multiple groups by a single comma (no spaces). Default is `safe`. 
Example: `modclean-benchmark -n safe,caution`

#### -m, --modules [modules]
Specify which npm modules to use for the benchmark. Multiple modules should be separated by a single comma (no spaces). Default is `express,lodash,moment,async`.
Example: `modclean-benchmark -m express,underscore,numeral,fs-extra`

#### -c, --no-clean
Turn off post-modclean cleanup process. By default, this script will cleanup the modules downloaded from npm after the process is complete and the benchmarks are ran, if you would rather keep the files, use this flag.

## Submitting Benchmarks
Feel free to submit benchmark results in the proper format in the [ModClean repository](https://github.com/KyleRoss/modclean) by creating a pull request.

## License
Licensed under the MIT License. See `LICENSE` in the repository for the full text.
