# Test data-files/in-network-rates-fee-for-service-sample-fhirized.ndjson against its schema. 
import subprocess

# make sure this one throws an exception
def test_schema_raises_no_exception():
    try:
        schema_test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/in-network-rates.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/in-network-rates-fee-for-service-sample-fhirized.ndjson"])
    except Exception as exc:
        assert True, f"'in-network-rates-fee-for-service-sample-fhirized.ndjson' raised an exception {exc}"

# make sure this one failed the validator. 1 == failure.
def test_in_network_rates():
    schema_test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/in-network-rates.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/in-network-rates-fee-for-service-sample-fhirized.ndjson"])
    assert schema_test_outcome == 1