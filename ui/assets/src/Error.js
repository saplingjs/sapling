var Errorz = new (Spineless.View.extend({
	tag: "error",

	defaults: {
		error: ""
	},

	init: function (opts) {
		this.super(this, "init", arguments);

		Spineless.on("error", function (err) {
			console.error("ERROR", err)
			var errs = err.responseJSON || [{message: err.responseText}];
			var template = [];

			for (var i = 0; i < errs.length; ++i) {
				template.push(errs[i].message);
			}

			this.onMessage(template.join(", "));
			this.container.classList.remove("ok");
		}.bind(this))

		Spineless.on("sync", function (resp, id, method) {
			if (method == "POST") {
				this.onMessage("OK", 1500);
				this.container.classList.add("ok");
			}
		}.bind(this))
	},

	template: [
		{tag: "button", className: "cancel", text: ""},
		{id: "display", className: "message"},
	],

	onMessage: function (message, timeout) {
		console.log("ERR", message)
		this.container.style.display = "block";
		this.model.error = message;
		this.render();

		setTimeout(function () {
			this.container.style.display = "none";
		}.bind(this), timeout || 5000);
	},

	render: function () {
		this.display.textContent = this.model.error;
	}
}))({superview: "error"});