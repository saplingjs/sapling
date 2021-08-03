/**
 * Load configuration
 */

/* Dependencies */
import fs from 'node:fs';
import yargs from 'yargs';
/* eslint-disable-next-line node/file-extension-in-import */
import { hideBin } from 'yargs/helpers';
import path from 'node:path';
import _ from 'underscore';

import { console } from '../lib/Cluster.js';
import SaplingError from '../lib/SaplingError.js';


/**
 * Load the configuration data. Should exist in a file
 * called "config.json" and must be valid JSON.
 *
 * @param {function} next Chain callback
 */
export default async function loadConfig(next) {
	const argv = yargs(hideBin(process.argv)).argv;

	/* Default configuration values */
	const defaultConfig = {
		publicDir: 'public',
		modelsDir: 'models',
		viewsDir: 'views',
		hooksDir: 'hooks',
		autoRouting: true,
		routes: 'routes.json',
		hooks: 'hooks.json',
		permissions: 'permissions.json',
		extension: 'html',
		secret: this.utils.randString(),
		showError: true,
		strict: false,
		limit: 100,
		production: 'auto',
		db: {
			driver: 'Memory',
		},
		render: {
			driver: 'HTML',
		},
		sessionStore: {
			type: null,
			options: {},
		},
		mail: {
			host: process.env.MAIL_HOST || '',
			port: process.env.MAIL_PORT || 465,
			secure: this.utils.trueBoolean(process.env.MAIL_TLS) || true,
			auth: {
				user: process.env.MAIL_USER,
				pass: process.env.MAIL_PASS,
			},
		},
		upload: {
			type: 'local',
			destination: 'public/uploads',
		},
		port: argv.port || this.opts.port || 3000,
		url: '',
	};

	this.config = {};
	Object.assign(this.config, defaultConfig);

	/* Location of the configuration */
	const configPath = path.join(this.dir, this.configFile || 'config.json');

	/* Load the configuration */
	if (fs.existsSync(configPath)) {
		/* If we have a config file, let's load it */
		const file = fs.readFileSync(configPath);

		/* Parse and merge the config, or throw an error if it's malformed */
		try {
			const c = JSON.parse(file.toString());
			_.extend(this.config, c);
		} catch (error) {
			throw new SaplingError('Error loading config', error);
		}
	} else {
		/* If not, let's add a fallback */
		_.extend(this.config, { name: 'untitled' });
	}

	/* Detect production environment */
	if (this.config.production === 'auto') {
		this.config.production = process.env.NODE_ENV === 'production';
	}

	/* Figure out automatic CORS */
	if (!('cors' in this.config)) {
		this.config.cors = !this.config.production;
	}

	/* Figure out automatic compression */
	if (!('compression' in this.config)) {
		this.config.compression = this.config.production;
	}

	console.log('Production mode is', this.config.production);
	console.log('Compression is', this.config.compression);
	console.log('CORS is', this.config.cors);

	/* Set other config based on production */
	if (this.config.production === true || this.config.production === 'on') {
		/* Check if there's a separate production config */
		const prodConfigPath = path.join(this.dir, (this.configFile && this.configFile.replace('.json', `.${process.env.NODE_ENV}.json`)) || `config.${process.env.NODE_ENV}.json`);

		if (fs.existsSync(prodConfigPath)) {
			/* If we have a config file, let's load it */
			const file = fs.readFileSync(prodConfigPath);

			this.config = {};
			Object.assign(this.config, defaultConfig);

			/* Parse and merge the config, or throw an error if it's malformed */
			try {
				const pc = JSON.parse(file.toString());
				_.extend(this.config, pc);
			} catch (error) {
				throw new SaplingError('Error loading production config', error);
			}
		}

		/* Set immutable production vars */
		this.config.strict = true;
		this.config.showError = false;
	}

	console.log('CONFIG', this.config);

	/* Set the app name */
	this.name = this.config.name;

	if (next) {
		next();
	}
}
