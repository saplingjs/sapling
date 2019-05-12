class Error {
    constructor(err) {
        this.template = {"errors":[]};

        this.parse(err);
    }

    parse(err) {
		if (typeof err === "string") {
			this.template.errors.push({
				title: err
			});
		} else if (Array.isArray(err)) {
			for (let i = 0; i < err.length; ++i) {
				this.parse(err[i]);
			}
		} else if (typeof err === "object") {
			this.template.errors.push(err);
		}
	}

    toJSON() {
		return JSON.stringify(this.template);
	}
}

module.exports = Error;