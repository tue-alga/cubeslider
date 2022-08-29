#!/usr/bin/python
import sys
import re

with open(sys.argv[1], encoding="utf-8") as console_log:
    json = ""
    lines = console_log.readlines()
    json += "["
    for line in lines:
        matches = re.findall(r"\([^)]*\)", line)
        matches = [m[1:-1] for m in matches]
        if len(matches) == 2 and matches[0] != "index":
            json += "[" + matches[0] + ", " + matches[1] + "],"
    json = json[:-1] + "]"
    with open("/home/ifidefix/Documents/interestingConfs/doublebasketsolved", "w+") as outputfile:
        outputfile.write(json)