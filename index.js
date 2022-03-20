#!/usr/bin/env node

/******************************************
 *                                        *
 *             S A P L I N G              *
 * -------------------------------------- *
 *   A minimalist Node.js framework for   *
 *   faster-than-light web development.   *
 *                                        *
 *****************************************/

/* Require native clustering bits */
import cluster from 'node:cluster';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import chalk from 'chalk';
import yargs from 'yargs';
/* eslint-disable-next-line node/file-extension-in-import */
import { hideBin } from 'yargs/helpers';

import Utils from './lib/Utils.js';

import App from './app.js';


const argv = yargs(hideBin(process.argv)).argv;


/* Determine if session store is configured */
const configPath = path.join(process.cwd(), 'config.json');
let sessionAvailable = false;

/* If we have a config file, let's load it */
if (await new Utils().exists(configPath)) {
	/* Parse config, or throw an error if it's malformed */
	try {
		const file = await fs.readFile(configPath);

		const c = JSON.parse(file.toString());
		if ('session' in c && 'driver' in c.session) {
			sessionAvailable = true;
		}
	} catch (error) {
		console.error('Error loading config');
		console.error(error, error.stack);
	}
}

if (cluster.isMaster && !argv.single && sessionAvailable) {
	console.log(chalk.green.bold('Starting Sapling!'));

	/* Create a new instance for each CPU available */
	const cpus = os.cpus().length;

	console.log(`Utilising ${cpus} CPUs`);
	for (let i = 0; i < cpus; i++) {
		cluster.fork();
	}
} else {
	if (argv.single || !sessionAvailable) {
		console.log(chalk.green.bold('Starting a single instance of Sapling!'));
	}

	/* Load a single instance */
	new App(process.cwd());
}
