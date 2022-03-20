/**
 * Load configuration
 */

/* Dependencies */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import yargs from 'yargs';
/* eslint-disable-next-line node/file-extension-in-import */
import { hideBin } from 'yargs/helpers';
import _ from 'underscore';

import { console } from '../lib/Cluster.js';
import SaplingError from '../lib/SaplingError.js';


/**
 * Digest config files and apply default config
 *
 * @returns {object} Config
 */
export async function digest() {
	let config = {};

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
			thumbnails: [
				{
					name: 'web',
					width: 1280,
				},
				{
					name: 'thumb',
					width: 128,
					height: 128,
					fit: 'cover',
				},
			],
		},
		port: argv.port || this.opts.port || 3000,
		url: '',
	};

	Object.assign(config, defaultConfig);

	/* Location of the configuration */
	const configPath = path.join(this.dir, this.configFile || 'config.json');

	/* Load the configuration */
	if (await this.utils.exists(configPath)) {
		/* If we have a config file, let's load it */
		const file = await fs.readFile(configPath);

		/* Parse and merge the config, or throw an error if it's malformed */
		try {
			const c = JSON.parse(file.toString());
			_.extend(config, c);
		} catch (error) {
			throw new SaplingError('Error loading config', error);
		}
	} else {
		/* If not, let's add a fallback */
		_.extend(config, { name: 'untitled' });
	}

	/* Detect production environment */
	if (config.production === 'auto') {
		config.production = process.env.NODE_ENV === 'production';
	}

	/* Figure out automatic CORS */
	if (!('cors' in config)) {
		config.cors = !config.production;
	}

	/* Figure out automatic compression */
	if (!('compression' in config)) {
		config.compression = config.production;
	}

	/* Set other config based on production */
	if (config.production === true || config.production === 'on') {
		/* Check if there's a separate production config */
		const prodConfigPath = path.join(this.dir, (this.configFile && this.configFile.replace('.json', `.${process.env.NODE_ENV}.json`)) || `config.${process.env.NODE_ENV}.json`);

		if (await this.utils.exists(prodConfigPath)) {
			/* If we have a config file, let's load it */
			const file = await fs.readFile(prodConfigPath);

			config = {};
			Object.assign(config, defaultConfig);

			/* Parse and merge the config, or throw an error if it's malformed */
			try {
				const pc = JSON.parse(file.toString());
				_.extend(config, pc);
			} catch (error) {
				throw new SaplingError('Error loading production config', error);
			}
		}

		/* Set immutable production vars */
		config.strict = true;
		config.showError = false;
	}

	return config;
}


/**
 * Load the configuration data. Should exist in a file
 * called "config.json" and must be valid JSON.
 *
 * @param {function} next Chain callback
 */
export default async function loadConfig(next) {
	/* Digest config */
	this.config = await digest.call(this);
	console.log('CONFIG', this.config);

	/* Set the app name */
	this.name = this.config.name;

	if (next) {
		next();
	}
}
