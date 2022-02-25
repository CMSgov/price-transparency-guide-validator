import subprocess

test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/in-network-rates/in-network-rates.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/in-network-rates-bundle-sample.json"])

def test_in_network_rates():
    assert test_outcome == 0