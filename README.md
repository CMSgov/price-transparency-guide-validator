# validator-workflow branch 
 In .github/workflows/Validator.yml the messiest job is that of the allowed amounts tests. 
 This goes back to my initial idea of first fixing tests/allowed amounts/test_allowed_amounts_sample.py and tests/allowed amounts/test_allowed_amounts_borked.py then applying the fix to all other tests. 

# How to run pytest locally 
Here are the two main ways I've been invoking pytest but there is more detailed information on how to do that [here](https://docs.pytest.org/en/latest/how-to/usage.html)
```
// in directory where the test_*.py is located
// this will run every test in the current directory
pytest
```
and
```
//this will allow you to run specific tests, single test etc.
pytest test_allowed_amounts_sample.py test_allowed_amounts_borked.py
```

# Correct Subprocess.Popen structue
This is the structure of running a test in the test*.py
This is extremely finnicky so this is what I have found that works "best" so far, we are still however facing permissions issues in the github runner. This subprocess structure will be rolled out to the other tests as soon as we can get it working fully within github runner :)

```
# check to see if file passes validation
def test_allowed_amounts():
    cmd = ["sudo", "../../validator", "../../schemas/allowed-amounts.json", "../../data-files/allowed-amounts.json"]
    run = subprocess.Popen(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)  # only set shell=True when cmd is one arg not a list.
    output, error= run.communicate()
    print("input: ", run.stdin)
    print("output: ", output)
    print("stderr: ", error)
    print("run: ", run)
    assert output == "Input JSON is valid.\n"
    ```

