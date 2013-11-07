// These are just some quick extensions to supertest. More documentation and a cleanup to come.

// We provide everything supertest provides.
var supertest = require('supertest');
module.exports = supertest;

// We also use tv4 for JSON Schema validation. It's exported for others to use.
var tv4 = supertest.tv4 = require('tv4');

var defaultCredentials = false;

supertest.defaultCredentials = function (user, pass) {
	defaultCredentials = new Buffer(user + ':' + pass).toString('base64');
};

var legalTldChars = 'abcdefghijklmnopqrstuvwxyz';
var legalDomainStartChars = legalTldChars + '1234567890';
var legalDomainChars = legalDomainStartChars + '-';

var legalConservativeLocalPartChars = 'abcdefghijklmnopqrstuvwxyz01234567890-._';
var legalLiberalLocalPartChars = '+^';

supertest.getRandomChar = function (choices) {
	return choices.charAt(Math.floor(Math.random() * choices.length));
};

supertest.generateRandomString = function (length, start, mid) {
	var res = '';
	mid = (typeof mid == 'undefined') ? start : mid;
	if (length >= 1) {
		res += supertest.getRandomChar(start);
		length--;
	}
	while (length-- >= 1) {
		res += supertest.getRandomChar(mid);
	}
	return res;
};

supertest.generateRandomLengthString = function (min, max, start, mid) {
	var span = max - min;
	return supertest.generateRandomString(
		Math.floor(Math.random() * span) + min,
		start, mid
	);
};

supertest.generateConservativeDomain = function () {
	var parts = [];
	parts.push(supertest.generateRandomLengthString(3, 25, legalDomainStartChars, legalDomainChars));
	parts.push(supertest.generateRandomLengthString(2, 3, legalTldChars));
	return parts.join('.');
};

supertest.generateLiberalDomain = function () {
	var parts = [], count = Math.floor(Math.random() * 5) + 1;
	for (var i = 0; i < count; i++) {
		parts.push(supertest.generateRandomLengthString(2, 25, legalDomainStartChars, legalDomainChars));
	}
	return parts.join('.');
};

supertest.generateConservativeEmail = function () {
	return (
		supertest.generateRandomLengthString(3, 25, legalConservativeLocalPartChars)
		+ '@' +
		supertest.generateConservativeDomain()
	);
};

// Get the Test prototype, because we're going to enhance it! \o/
var Test = supertest.Test;

// Sets the HTTP Basic auth header.
Test.prototype.auth = function () {
	return this.set('Authorization', 'Basic ' + defaultCredentials);
};

// Send data with type form, else it would default to JSON.
Test.prototype.sendForm = function (data) {
	return this.type('form').send(data);
};

// Register a JSON schema the result has to match against.
Test.prototype.expectSchema = function (schema, e) {
	if (!this._schemas) this._schemas = [];
	this._schemas.push(schema);
	if (typeof e == 'function') this.end(e);
	return this;
};

// Extend Test's assert() method in order to do the JSON Schema tests.
(function (oldAssert) {
	Test.prototype.assert = function (res, fn) {
		var ret = oldAssert.apply(this, arguments);
		if (!this._schemas) return ret;
		for (var i = 0; i < this._schemas.length; i++) {
			if (!tv4.validate(res.body, this._schemas[i])) {
				var e = tv4.error;
				return fn(new Error(
					'schema validation failed (' + e.code + ' at ' + e.schemaPath + '): ' + e.message
				));
			}
		}
		return ret;
	};
})(Test.prototype.assert);
