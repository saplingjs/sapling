;(function (win, document) {

//list of attributes that require special processing
var blacklist = [
	"id",
	"tag",
	"children",
	"className",
	"text",
	"html",
	"view",
	"container"
];

//list of input nodeName variations
var INPUT_NODE = [
	"INPUT",
	"SELECT",
	"TEXTAREA"
];

//feature detection constants
var DETECT = {
	ON_INPUT: (document.createElement("input").oninput === null)
};

//unique number
var UID = 1;

function getUID () {
	return UID++;
}

function isEmpty (v) {
	return v === undefined || v === null;
}

//save reference to prototype methods
var slice = Array.prototype.slice;
var spaceRegex = /\s+/;

/**
* merge all object keys from the argument list
* into one object and return it.
*/
function merge () {
	var target = {};
	var args = slice.call(arguments);

	//loop over all the arguments
	for (var i = 0; i < args.length; ++i) {
		if (typeof args[i] !== "object") continue;

		for (var key in args[i]) {
			if (!(key in target))
				target[key] = args[i][key];
		}
	}

	return target;
}

//helper method to create extend functions on widgets
function createExtend (parent) {
	return function (opts, tag) {
		var cls = function () {
			if (this instanceof cls) {
				this.init && this.init.apply(this, arguments);	
			} else {
				cls.super.apply(cls, arguments);
			}
		};

		//we don't want to use the original constructor
		//or else it will call `init`
		function Dummy(){}
  		Dummy.prototype = parent.prototype;

		//extend the prototype with the widget
		cls.prototype = new Dummy;
		cls.prototype.constructor = cls;

		//give access to the parent class
		cls.super = function (ctx, method, args) {
			parent.prototype[method].apply(ctx, args);
		};

		//give an extend function to this class
		cls.extend = createExtend(cls);

		//extend the class with these options
		for (var key in opts)
			cls.prototype[key] = opts[key];

		cls.prototype.super = cls.super;//parent.prototype;
		if (tag) { cls.prototype.tag = tag; }

		return cls;
	};
}

/**
* Spineless Event emitter class.
*/
var Event = function () {
	this.tag = "Event";
	this.init && this.init.apply(this, arguments);
};

Event.prototype = {
	init: function () {
		this._handlers = {};
	},

	on: function (evt, cb) {
		if (spaceRegex.test(evt)) {
			//if delimetered by a space, call on
			//for every event.
			var evts = evt.split(spaceRegex);
			for (var i = 0; i < evts.length; ++i)
				this.on(evts[i], cb);

			return this;
		}

		//define callbacks with an object
		if (typeof evt === "object") {
			//key is the event name, value is the
			//callback function
			for (var evtName in evt)
				this.on(evtName, evt[evtName]);
		}

		if (!this._handlers[evt])
			this._handlers[evt] = [];

		this._handlers[evt].push(cb);
		return this;
	},

	off: function (evt, cb) {
		//remove every handler
		if (!evt && !cb) {
			this._handlers = {};
			return this;
		}

		if (!cb) {
			//remove every handler with that name
			this._handlers[evt] = [];
		} else {
			var handlers = this._handlers[evt] || [];

			//find the exact handler
			for (var i = handlers.length; i >= 0; --i) {
				if (handlers[i] === cb) {
					handlers.splice(i, 1);
				}
			}
		}

		return this;
	},

	emit: function (evt) {
		//save all the arguments except the first one
		var args = slice.call(arguments, 1);
		var node = this;

		//if there is a colon, emit wildcards
		if (evt.indexOf(":") !== -1) {
			var evtSplat = evt.split(":");
			var wildcard = evtSplat[0] + ":*";
			
			//don't emit wildcard if already a wildcard
			if (evtSplat[1] !== "*") {
				var wildArgs = slice.call(arguments, 0);
				wildArgs[0] = wildcard;
				
				this.emit.apply(this, wildArgs);
			}
		}
		
		do {
			//execute the handlers
			if (!node._handlers || !node._handlers[evt]) continue;

			for (var i = 0; i < node._handlers[evt].length; ++i) {
				//skip if the value is not executable
				if (typeof node._handlers[evt][i] !== "function")
					continue;

				node._handlers[evt][i].apply(node, args);
			}
		} while (node = node.parent);

		return this;
	},

	once: function (evt, cb) {
		this.on(evt, function temp () {
			cb && cb.apply(this, arguments);
			this.off(evt, temp);
		});

		return this;
	}
};

//setup event aliases
Event.prototype.bind = Event.prototype.subscribe = Event.prototype.on;
Event.prototype.unbind = Event.prototype.unsubscribe = Event.prototype.off;
Event.prototype.trigger = Event.prototype.publish = Event.prototype.emit;

Event.extend = createExtend(Event);

var views = [];
win.onhashchange = function () {
	for (var i = 0; i < views.length; ++i)
		views[i].executeRoutes();
}

//create the global namespace
var Spineless = win.Spineless = new Event;
Spineless.$ = win.$ || win.jQuery || win.Zepto;

/**
* Spineless Views are the backbone of the framework. Use
* this class to build your DOM structure in JSON, assign
* event handlers and communicate with the server.
*/
var View = Event.extend({

	/**
	* Default methods
	*/
	init: function (opts) {
		View(this, "init", arguments);
		opts = opts || {};

		//pass in the parent view through options
		this.parent = opts.parent;
		this.superview = opts.superview || (this.parent && this.parent.el);
		this.children = [];
		views.push(this);

		//internal structures
		this.model = {};
		this.form = [];

		this.uid = "i" + getUID();

		//template exists in DOM, parse it
		if (typeof this.template === "string") {
			this.el = document.getElementById(this.template);
			this.parseTemplate(this.el);
		} else { //DOM parent fragment
			this.el = document.createDocumentFragment();
			this.renderTemplate(this.el);
		}
		
		//keep a reference to this class
		var self = this;

		//copy items from opts into the model
		for (var item in this.defaults) {
			if (item in opts) {
				this.model[item] = opts[item];
				//delete opts[item];
			} else {
				this.model[item] = this.defaults[item];
			}
		}

		//bind forms to model
		if (this.defaults)
			this._bindForms();

		//attach any event handlers
		if (typeof this.events === "object") {
			for (var on in this.events) {
				var parsed = on.split(" ");
				var cb = this[this.events[on]];
				
				//ensure correct format and element exists
				if (parsed.length !== 2 || !this[parsed[1]]) 
					continue;

				this.attachEvent(parsed[1], parsed[0], cb);
			}
		}

		//a very simple route handler
		if (typeof this.routes === "object") {
			this.executeRoutes();
		}

		this.on("change child:* route", this.render);

		//execute render after initialisation
		setTimeout(function() {
			self.render && self.render.call(self);

			//check to see if there is a parent el
			if (!self.superview && self.parent)
				self.superview = self.parent.el;

			if (typeof self.superview === "string")
				self.superview = document.getElementById(self.superview)

			self.superview && self.superview.appendChild(self.el);
			self.emit("init");
		}, 0);
	},

	executeRoutes: function () {
		var hash = location.hash.substr(1);
			
		for (var route in this.routes) {
			if (route === hash) {
				this[this.routes[route]].call(this, hash);

				this.emit("route", route);
				this.emit("route:" + route);
			}
		}
	},

	attachEvent: function (obj, evt, cb) {
		var self = this;

		//add a 2nd level evt handler
		this[obj]["on" + evt] = function (e) {
			//simple IE fix
			e = e || window.event;

			self.emit("dom:" + evt, e, self);
			return cb && cb.call(self, e, evt, obj, self[obj]);
		};
	},

	/**
	* Heirarchy methods
	*/
	addChild: function (child) {
		child.parent = this;

		this.children.push(child);
		this.emit("child:add", child);
		child.emit("parent:add", this);
	},

	find: function (conditions, each) {
		var l = this.children.length;
		var child;
		var results = [];

		for (var i = 0; i < l; ++i) {
			var match = true;
			child = this.children[i];

			for (var key in conditions) {
				if (child[key] != conditions[key] && child.model[key] != conditions[key]) {
					match = false;
					break;
				}
			}

			if (match) {
				results.push(child);
				each && each(child);
			}
		}

		return results;
	},

	removeChild: function (child) {
		child.removeFromParent();
	},

	removeChildren: function () {
		while (this.children.length) {
			this.children[0].removeFromParent();		
		}
	},

	removeFromParent: function () {
		if (this.parent) {
			var children = this.parent.children;
			for (var i = children.length - 1; i >= 0; --i) {
				if (children[i] === this) {
					children.splice(i, 1);
					break;
				}
			}
		}

		//wrap this in a try catch to prevent exception
		//when removing in a blur handler
		try {
			this.superview.removeChild(this.container);
		} catch(e) {}
		
		this.parent && this.parent.emit("child:remove", this);
		this.emit("parent:remove", parent);
	},

	/**
	* Render methods
	*/
	renderTemplate: function (parent) {
		var tpl = this.template;
		if (!tpl) return;
		
		var frag = document.createDocumentFragment();

		for (var i = 0; i < tpl.length; ++i) {
			View.toDOM(this, tpl[i], frag);
		}

		if (!this.container) {
			var container = document.createElement("div");
			container.setAttribute("class", "container");
			
			if (this.tag) {
				container.classList.add(this.tag)
			}

			this.container = container;
		}

		this.container.appendChild(frag);
		parent.appendChild(this.container);
	},

	parseTemplate: function (parent) {
		var collection = parent.childNodes;
		
		for (var i = 0; i < collection.length; ++i) {
			var id = collection[i].id || collection[i].name;

			//if the property hasn't been taken, apply to class
			if (id) {
				//if it exists as a node, turn it into an array
				if (this[id] && this[id].nodeName) {
					this[id] = [ this[id], collection[i] ];
				} else if (this[id] && 'length' in this[id]) {
					this[id].push(collection[i]);
				} else {
					this[id] = collection[i];
				}

				//add the node to the form array
				if (INPUT_NODE.indexOf(collection[i].nodeName) !== -1) {
					this.form.push(collection[i]);
				}
			}

			//recurse the tree
			if (collection[i].childNodes)
				this.parseTemplate(collection[i]);
		}
	},

	/**
	* Any form elements with the same property
	* as the model should be bound
	*/
	_bindForms: function () {
		
		//callback to handle all changes
		function handleChange () {
			for (var i = 0; i < this.form.length; ++i) {
				//mock the evt object
				handleSingleChange.call(this, {target: this.form[i]});
			}
		}

		//handle a change on a single form item
		function handleSingleChange (evt) {
			var input = evt.target;
			var key = input.id || input.name;
			var value;

			if (!key) { return; }

			if (input.type === "checkbox") {
				value = input.checked;
			} else if (input.type === "radio") {
				//only update the value if checked
				if (input.checked)
					value = input.value;
			} else {
				value = input.value;
			}
			
			//if value has actually been set
			if (value !== undefined) {
				var oldvalue = this.model[key];
				
				//emit the change events
				if (this.model[key] !== value) {
					this.emit("prechange", key, value);
					this.emit("prechange:"+key, value);

					this.model[key] = value;
					
					this.emit("change", key, value, oldvalue);
					this.emit("change:"+key, value, oldvalue);
				}
			}
		}

		if (DETECT.ON_INPUT) {
			//if the new oninput event is supported, use that
			for (var i = 0; i < this.form.length; ++i) {
				this.form[i].addEventListener("input", handleSingleChange.bind(this), false);
				this.form[i].addEventListener("change", handleSingleChange.bind(this), false);
			}
		} else {
			//otherwise setup an interval to poll the value
			this._interval = setInterval(handleChange, 300);
		}
	},

	_unbindForms: function () {
		//if we had to resort to interval
		if (this._interval) 
			clearInterval(this._interval);
	},

	/**
	* Recursively generate a new object containing
	* the models of the views.
	*/
	getModel: function () {
		var model = merge({}, this.model);

		//serialize all children if they exist		
		if (this.children.length) {
			model.children = [];

			for (var i = 0; i < this.children.length; ++i) {
				model.children.push(
					this.children[i].getModel()
				);
			}
		}

		return model;
	},

	set: function (key, value) {
		//allow passing an object
		if (typeof key === "object") {
			for (var realkey in key) {
				this.set(realkey, key[realkey]);
			}

			return;
		}

		this.emit("prechange", key, value);
		this.emit("prechange:"+key, value);
		
		var oldvalue = this.model[key];
		this.model[key] = value;

		if (!isEmpty(value) && this[key] && this.form.indexOf(this[key]) > -1) {
			this[key].value = value;

			if (this[key].type === "checkbox") {
				this[key].checked = !!value;
			}
		}

		this.emit("change", key, value, oldvalue);
		this.emit("change:"+key, value, oldvalue);
	},

	serialize: function () {
		return JSON.stringify(this.getModel());
	},

	unserialize: function () {},

	/**
	* Network methods
	*/
	sync: function(method, url, data) {
		if (typeof this.validate === "function") {
			var err = this.validate();
			if (err) {
				this.validationError = err;
				this.emit("invalid", err);
				return err;
			}
		}

		var id = '' + getUID();
		var type = "";

		if (method == "POST" || method == "DELETE")
			type = 'application/json';

		var self = this;
		Spineless.$.ajax({
			type: method,
			url: url,
			dataType: 'json',
			data: JSON.stringify(data),
			contentType: type,

			success: function (resp) {
				self.emit(id, resp);
				self.emit("sync", resp);
				self.emit("sync:" + id, resp);
				self.emit("sync:" + method.toLowerCase(), resp);
				Spineless.emit("sync", resp, id, method);
			},

			error: function (resp) {
				self.emit("error", resp);
				self.emit("error:" + id, resp);
				self.emit("error:" + method.toLowerCase(), resp);
				Spineless.emit("error", resp, id, method);
			}
		});

		return id;
	},

	post: function (url, data) {
		return this.sync("POST", url || this.url, data || this.model);
	},

	delete: function (url, data) {
		return this.sync("DELETE", url || this.url, data || this.model);
	},

	show: function () {
		this.container.style.display = "block";
	},

	hide: function () {
		this.container.style.display = "none";
	},

	//shim functions
	render: function () {
		for (var i = 0; i < this.children.length; ++i) {
			this.children[i].render();
		}
	}
});

/**
* Static method to turn a JSON template into a DOM structure.
* @param ctx - Instance object to save ID references to
* @param obj - Template object to convert
* @param parent - Append the element to this parent
* @return HTMLElement
*/
View.toDOM = function (ctx, obj, parent) {
	if (arguments.length < 3) {
		parent = obj;
		obj = ctx;
		ctx = null;
	}

	//template is a view instead of DOM
	if (obj.view && typeof obj.view === "string") {
		obj.superview = parent
		var view = new obj.view(obj);
		//view.superview = parent;
		
		if (ctx) {
			ctx.addChild(view);

			if (obj.id) {
				ctx[obj.id] = view;
			}
		}

		return view.el;
	}

	var tag = obj.tag || "div";
	var el = document.createElement(tag);

	for (var key in obj)
		if (blacklist.indexOf(key) === -1)
			el.setAttribute(key, obj[key]);

	if (obj.className)
		el.setAttribute("class", obj.className);

	if ('text' in obj)
		el.textContent = el.innerText = obj.text;

	if ('html' in obj)
		el.innerHTML = obj.html;

	if (obj.id && !obj.name) 
		el.setAttribute("name", obj.id);

	obj.id && el.classList && el.classList.add(obj.id)

	if (obj.container && ctx) {
		ctx['container'] = el;
		parent = el;
	}

	//render children
	if (obj.children) {
		for (var i = 0; i < obj.children.length; ++i) {
			View.toDOM(ctx, obj.children[i], el);
		}
	}

	//append to a parent if specified
	if (parent && parent != el) 
		parent.appendChild(el);

	if (ctx) {
		//save a ref on the context
		if (obj.id) ctx[obj.id] = el;

		//if an input node, save to forms array
		if (INPUT_NODE.indexOf(tag.toUpperCase()) !== -1) {
			ctx.form.push(el);
		}
	} 

	return el;
}



View.extend = createExtend(View);

/**
* Source url for retrieving data
*/
var Source = function(opts) {
	var collection = new View;

	Spineless.$.ajax({
		url: opts.url,
		dataType: 'json',
		success: function (resp) {
			for (var i = 0; i < resp.length; ++i) {
				var view = new opts.view(resp[i]);
				collection.addChild(view);
			}

			setTimeout(function () {
				opts.success(collection)
			}, 0);
		}
	});

	return collection;
};

Source.extend = createExtend(Source);

//assign the classes to the namespace
Spineless.Event = Event;
Spineless.View = View;
Spineless.merge = merge;
Spineless.Source = Source;
Spineless.views = views;

Spineless.TextField = View.extend({

});

})(window, window.document);
