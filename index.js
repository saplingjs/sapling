/*****************************
 *                           *
 *       S A P L I N G       *
 * ------------------------- *
 *   Faster-than-light web   *
 *   development framework   *
 *                           *
 *****************************/


/* Require native clustering bits */
const cluster = require('cluster');
const os = require('os');
const chalk = require('chalk');
const argv = require('yargs').argv;

if (cluster.isMaster && !argv.single) {
	console.log(chalk.green.bold("Starting Sapling!"));

	/* Create a new instance for each CPU available */
	const cpus = os.cpus().length;

	console.log(`Utilising ${cpus} CPUs`);
	for (let i = 0; i<cpus; i++) {
		cluster.fork();
	}
} else {
	if(argv.single)
		console.log(chalk.green.bold("Starting a single instance of Sapling!"));

	/* Load a single instance */
	const App = require("./app");
	const app = new App(__dirname);
}
