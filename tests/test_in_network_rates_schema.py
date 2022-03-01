# Test data-files/in-network-rates-bundle-sample.json against the in network rates schema
import subprocess

# check for exceptions
def test_schema_raises_no_exception():
    try:
        schema_test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/in-network-rates/in-network-rates.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/in-network-rates-bundle-sample.json"])
    except Exception as exc:
        assert False, f"'in-network-rates-bundle-sample.json' raised an exception {exc}"

# check if it validates successfully. 0 == success. 
def test_in_network_rates():
    schema_test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/in-network-rates/in-network-rates.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/in-network-rates-bundle-sample.json"])
    assert schema_test_outcome == 0