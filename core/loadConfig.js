/**
 * Load configuration
 */


/* Dependencies */
const argv = require('yargs').argv;
const fs = require("fs");
const path = require("path");
const _ = require("underscore");

const SaplingError = require("../lib/SaplingError");


/**
 * Load the configuration data. Should exist in a file
 * called "config.json" and must be valid JSON.
 * 
 * @param {function} next Chain callback
 */
module.exports = async function loadConfig(next) {
    /* Default configuration values */
    const defaultConfig = {
        "staticDir": "public",
        "modelsDir": "models",
        "viewsDir": "views",
        "hooksDir": "hooks",
        "autoRouting": true,
        "routes": "routes.json",
        "hooks": "hooks.json",
        "extension": "html",
        "secret": this.utils.randString(),
        "showError": true,
        "strict": false,
        "production": "auto",
        "db": {
            "driver": "Memory"
        },
        "render": {
            "driver": "HTML"
        },
        "sessionStore": {
            "type": null,
            "options": {}
        },
        "mail": {
            "type": "SMTP",
            "service": "Gmail",
            "auth": {
                user: process.env.MAIL_USER,
                password: process.env.MAIL_PASS
            }
        },
        "upload": {
            "type": "local",
            "destination": "public/uploads"
        },
        "port": argv.port || this.opts.port || 3000,
        "url": ""
    };

    this.config = {};
    Object.assign(this.config, defaultConfig);

    /* Location of the configuration */
    const configPath = path.join(this.dir, "config.json");

    /* Load the configuration */
    if(fs.existsSync(configPath)) {
        /* If we have a config file, let's load it */
        let file = fs.readFileSync(configPath);

        /* Parse and merge the config, or throw an error if it's malformed */
        try {
            const c = JSON.parse(file.toString());
            _.extend(this.config, c);
        } catch (e) {
            console.error("Error loading config");
            console.error(e, e.stack);
        }
    } else {
        /* If not, let's add a fallback */
        _.extend(this.config, {"name": "untitled"});
    }

    /* Detect production environment */
    if(this.config.production === "auto") {
        this.config.production = process.env.NODE_ENV === "production";
    }

    /* Figure out automatic CORS */
    if(!('cors' in this.config)) {
        this.config.cors = !this.config.production;
    }

    console.log("Production mode is", this.config.production);
    console.log("CORS is", this.config.cors);

    /* Set other config based on production */
    if(this.config.production === true || this.config.production === "on") {
        /* Check if there's a separate production config */
        const prodConfigPath = path.join(this.dir, `config.${process.env.NODE_ENV}.json`);
        
        if(fs.existsSync(prodConfigPath)) {
            /* If we have a config file, let's load it */
            let file = fs.readFileSync(prodConfigPath);

            this.config = {};
            Object.assign(this.config, defaultConfig);

            /* Parse and merge the config, or throw an error if it's malformed */
            try {
                const pc = JSON.parse(file.toString());
                _.extend(this.config, pc);
            } catch (e) {
                console.error(new SaplingError("Error loading production config", e));
            }
        }

        /* Set immutable production vars */
        this.config.strict = true;
        this.config.showError = false;
    }

    console.log("CONFIG", this.config);

    /* Set the app name */
    this.name = this.config.name;

    next();
};
