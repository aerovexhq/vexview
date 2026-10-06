# fish completion for vexview

complete -c vexview -s h -l help -d "Print help information"
complete -c vexview -s V -l version -d "Print version information"
complete -c vexview -s e -l edit -d "Open directly in edit mode"
complete -c vexview -s f -l fullscreen -d "Launch in fullscreen mode"
complete -c vexview -s s -l slideshow -d "Start slideshow mode immediately"
complete -c vexview -s i -l info -d "Inspect media metadata in terminal and exit"
complete -c vexview -s c -l convert -r -d "Convert input image to output format"
complete -c vexview -s q -l quality -x -a "100 95 90 85 80 75 50" -d "Compression quality (1-100)"
complete -c vexview -l width -x -d "Target width in pixels"
complete -c vexview -l height -x -d "Target height in pixels"
complete -c vexview -l completions -x -a "bash zsh fish powershell" -d "Generate shell completion script"

complete -c vexview -k -a "(__fish_complete_suffix .png .jpg .jpeg .webp .svg .gif .bmp .avif .tiff .ico .mp4 .mkv .webm .mov .avi)"
