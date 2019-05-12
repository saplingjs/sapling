const cluster = require("cluster");
const chalk = require('chalk');
const pid = process.pid;

let Cluster = {
	console: {
		log(...args) {
			console.log(Cluster.workerID(), ...args);
		},
		warn(...args) {
			console.warn(Cluster.workerID(), ...args);
		},
		error(...args) {
			console.error(Cluster.workerID(), ...args);
		}
	},

	logger(tokens, req, res) {
		return `${Cluster.workerID()} ${[
    chalk.blue(`[${tokens.date(req, res, 'iso')}]`),
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens['response-time'](req, res), 'ms'
].join(' ')}`;
	},

	workerID() {
		return chalk.magenta(`[W${cluster.worker.id}/${pid}]`);
	},

	listening(port) {
		console.log(`${chalk.magenta(`Worker ${cluster.worker.id} (${pid})`)} now listening on port ${port}`);
	}
};

module.exports = Cluster;