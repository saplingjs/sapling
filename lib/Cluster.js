/**
 * Cluster
 *
 * Handles console logging in a way that the responding core is
 * identified in each log message.
 */

const cluster = require('cluster');
const chalk = require('chalk');
const pid = process.pid;


let currentIndent = 0;
const indentAmount = 4;

const Cluster = {
	/* Prefixing native console methods with worker ID */
	console: {
		log(...args) {
			console.log(Cluster.workerID() + ' '.repeat(currentIndent), ...args);
		},
		warn(...args) {
			console.warn(Cluster.workerID() + ' '.repeat(currentIndent), ...args);
		},
		error(...args) {
			console.error(Cluster.workerID() + ' '.repeat(currentIndent), ...args);
		},
		group(...args) {
			console.log(Cluster.workerID(), chalk.blue.bold(...args));
			currentIndent += indentAmount;
		},
		groupEnd() {
			currentIndent -= indentAmount;
		}
	},

	/* Create an access log line */
	logger(tokens, request, res) {
		return `${Cluster.workerID()} ${[
			chalk.cyan(`[${tokens.date(request, res, 'iso')}]`),
			tokens.method(request, res),
			tokens.url(request, res),
			tokens.status(request, res),
			tokens['response-time'](request, res),
			'ms'
		].join(' ')}`;
	},

	/* Format the worker ID + process ID as a tag to prefix to other messages */
	workerID() {
		return chalk.magenta(`[W${cluster.worker ? cluster.worker.id : 0}/${pid}]`);
	},

	/* Log a wakeup message when a new worker is created */
	listening(port) {
		console.log(`${chalk.magenta(`Worker ${cluster.worker ? cluster.worker.id : 0} (${pid})`)} now listening on port ${port}`);
	}
};

module.exports = { Cluster, console: Cluster.console };
