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
import path from 'node:path';
import cluster from 'node:cluster';
import os from 'node:os';
import chalk from 'chalk';
import yargs from 'yargs';
/* eslint-disable-next-line node/file-extension-in-import */
import { hideBin } from 'yargs/helpers';
import fs from 'node:fs';

import App from './app.js';


const argv = yargs(hideBin(process.argv)).argv;


/* Determine if session store is configured */
const configPath = path.join(process.cwd(), 'config.json');
let sessionAvailable = false;

if (fs.existsSync(configPath)) {
	/* If we have a config file, let's load it */
	const file = fs.readFileSync(configPath);

	/* Parse config, or throw an error if it's malformed */
	try {
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
