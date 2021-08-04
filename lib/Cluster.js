/**
 * Cluster
 *
 * Handles console logging in a way that the responding core is
 * identified in each log message.
 */

/* Dependencies */
import cluster from 'node:cluster';
import process from 'node:process';
import chalk from 'chalk';

const pid = process.pid;


let currentIndent = 0;
const indentAmount = 4;
const originalConsole = console;


/* Prefixing native console methods with worker ID */
const prefixedConsole = {
	log(...args) {
		if (process.env.NODE_ENV !== 'test') {
			originalConsole.log(Cluster.workerID() + ' '.repeat(currentIndent), ...args);
		}
	},
	warn(...args) {
		if (process.env.NODE_ENV !== 'test') {
			originalConsole.warn(Cluster.workerID() + ' '.repeat(currentIndent), ...args);
		}
	},
	error(...args) {
		if (process.env.NODE_ENV !== 'test') {
			originalConsole.error(Cluster.workerID() + ' '.repeat(currentIndent), ...args);
		}
	},
	group(...args) {
		if (process.env.NODE_ENV !== 'test') {
			originalConsole.log(Cluster.workerID(), chalk.blue.bold(...args));
			currentIndent += indentAmount;
		}
	},
	groupEnd() {
		if (process.env.NODE_ENV !== 'test') {
			currentIndent -= indentAmount;
		}
	},
};


const Cluster = {
	console: prefixedConsole,

	/* Create an access log line */
	logger(tokens, request, response) {
		if (process.env.NODE_ENV !== 'test') {
			return `${Cluster.workerID()} ${[
				chalk.cyan(`[${tokens.date(request, response, 'iso')}]`),
				tokens.method(request, response),
				tokens.url(request, response),
				tokens.status(request, response),
				tokens['response-time'](request, response),
				'ms',
			].join(' ')}`;
		}
	},

	/* Format the worker ID + process ID as a tag to prefix to other messages */
	workerID() {
		return chalk.magenta(`[W${cluster.worker ? cluster.worker.id : 0}/${pid}]`);
	},

	/* Log a wakeup message when a new worker is created */
	listening(port) {
		if (process.env.NODE_ENV !== 'test') {
			console.log(`${chalk.magenta(`Worker ${cluster.worker ? cluster.worker.id : 0} (${pid})`)} now listening on port ${port}`);
		}
	},
};

export { prefixedConsole as console };
export default Cluster;
