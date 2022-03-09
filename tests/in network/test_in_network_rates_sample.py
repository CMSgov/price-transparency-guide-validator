# Test data-files/in-network-rates-bundle-sample.json against the in network rates schema
import subprocess


# check for exceptions
def test_in_network_rates_raises_no_exception():
    cmd = ["../../validator", "../../schemas/in-network-rates.json", "../../data-files/in-network-rates-bundle-sample.json"]
    try:
        run = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    except Exception as exc:
        assert False, f"'in-network-rates-bundle-sample.json' raised an exception {exc}"

# check if it validates successfully. 0 == success.
def test_in_network_rates():
    cmd = ["../../validator", "../../schemas/in-network-rates.json", "../../data-files/in-network-rates-bundle-sample.json"]
    run = subprocess.Popen(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    run.communicate()
    assert run.returncode == 0