let assert = require('assert');
let expect = require('chai').expect;

let Ajv = require("ajv");
const ajv = new Ajv({allErrors: true}) // options can be passed, e.g. {allErrors: true}

let in_network_rates_schema = require("../../schemas/in-network-rates.json");
const validate = ajv.compile(in_network_rates_schema);

let in_network_rates_bundle_sample = require("../../data-files/in-network-rates-bundle-sample.json");
let in_network_rates_capitation_sample = require("../../data-files/in-network-rates-capitation-sample.json");
let in_network_rates_fee_for_service_sample = require("../../data-files/in-network-rates-fee-for-service-sample.json");


describe("in network schema", function(){
    it("has a valid json schema", function(){
        expect(typeof in_network_rates_schema).to.equal("object");
        expect(typeof validate).to.equal("function");
    })
    it("has valid JSON fee-for-service example", function(){
        const valid = validate(in_network_rates_fee_for_service_sample);
        expect(valid).to.be.true;
    })
    it("has valid JSON bundle example", function(){
        const valid = validate(in_network_rates_bundle_sample);
        expect(valid).to.be.true;
    }) 
    it("has valid capitation example", function(){
        const valid = validate(in_network_rates_capitation_sample);
        expect(valid).to.be.true;
    }) 
})
