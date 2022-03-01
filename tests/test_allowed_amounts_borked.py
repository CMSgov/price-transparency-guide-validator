# Test data-files/allowed-amounts-borked.json against its schema 
import subprocess

# test to make sure this one failed the validator. 1 == failure.
def test_allowed_amounts_borked():
    schema_test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/allowed-amounts/allowed-amounts.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/allowed-amounts-borked.json"])
    assert schema_test_outcome == 1