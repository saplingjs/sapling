const cluster = require("cluster");
const chalk = require('chalk');
const pid = process.pid;

let Cluster = {
	console: {
		log: function(...args) {
			console.log(Cluster.workerID(), ...args);
		},
		warn: function(...args) {
			console.warn(Cluster.workerID(), ...args);
		},
		error: function(...args) {
			console.error(Cluster.workerID(), ...args);
		}
	},

	logger: function (tokens, req, res) {
		return Cluster.workerID() + " " + [
			chalk.blue("[" + tokens.date(req, res, 'iso') + "]"),
			tokens.method(req, res),
			tokens.url(req, res),
			tokens.status(req, res),
			tokens['response-time'](req, res), 'ms'
		].join(' ')
	},

	workerID: function () {
		return chalk.magenta("[W" + cluster.worker.id + "/" + pid + "]");
	},

	listening: function (port) {
		console.log(chalk.magenta("Worker " + cluster.worker.id + " (" + pid + ")") + " now listening on port " + port);
	}
};

module.exports = Cluster;