// require "spec_helper"

let assert = require('assert');
let expect = require('chai').expect;

let Ajv = require("ajv");
const ajv = new Ajv({allErrors: true}) // options can be passed, e.g. {allErrors: true}

let allowed_amounts_schema = require("../../schemas/allowed-amounts.json");
const validate = ajv.compile(allowed_amounts_schema);

let allowed_amounts = require("../../data-files/allowed-amounts.json");
let allowed_amounts_empty = require("../../data-files/allowed-amounts-empty.json");


describe("allowed amounts schema", function(){
    it("has a valid json schema", function(){
        expect(typeof allowed_amounts_schema).to.equal("object");
        expect(typeof validate).to.equal("function");
    })

    it("validates the allowed amounts example", function(){
        const valid = validate(allowed_amounts);
        expect(valid).to.be.true;
    })
    it("validates the allowed amounts empty example", function(){
        const valid = validate(allowed_amounts_empty);
        expect(valid).to.be.true;
    })
});

