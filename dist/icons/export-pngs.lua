-- export-pngs.lua
-- exports each layer on a png with the same name
-- assumes there is one layer called "background" that does not get a png.
-- the background layer is not included in the pngs

if #argv ~= 1 then
    io.stderr:write("Usage: ipescript export-pngs <inputfile>\n")
    return
end

inname = argv[1]

doc = assert(ipe.Document(inname))

assert(doc:runLatex())

-- set all layers to not be visible
for i, p in doc:pages() do
    for j, l in pairs(p:layers()) do
        p:setVisible(1, l, false)
    end
end

-- for each layer, set it to be visible, call pdftocairo to create the png
last_layer = "background"
for i, p in doc:pages() do
    for j, l in pairs(p:layers()) do
        if l == last_layer then goto continue end
        p:setVisible(1, last_layer, false)
        p:setVisible(1, l, true)
        doc:save(argv[1], pdf, {})
        command = string.format("pdftocairo -singlefile -png -transp -scale-to 64 %s %s", argv[1], l)
        os.execute(command)
        last_layer = l
        ::continue::
    end
end
