/******************************************
 *                                        *
 *             S A P L I N G              *
 * -------------------------------------- *
 *   A minimalist Node.js framework for   *
 *   faster-than-light web development.   *
 *                                        *
 *****************************************/


/* Require native clustering bits */
const cluster = require('cluster');
const os = require('os');
const chalk = require('chalk');
const argv = require('yargs').argv;
const path = require('path');
const fs = require('fs');

/* Determine if session store is configured */
const configPath = path.join(__dirname, 'config.json');
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
	const App = require('./app');
	const app = new App(__dirname);
}
