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

if (cluster.isMaster) {
	console.log(chalk.green.bold("Starting Sapling!"));

	/* Create a new instance for each CPU available */
	const cpus = os.cpus().length;

	console.log(`Utilising ${cpus} CPUs`);
	for (let i = 0; i<cpus; i++) {
		cluster.fork();
	}
} else {
	/* Load a single instance */
	const App = require("./app");
	const app = new App("./");
}
