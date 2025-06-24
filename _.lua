local input = "./1.rbxm"
local output = "./2.rbxmx"

local file = fs.read(input)
fs.write(output, file, "rbxmx")