# bash completion for vexview
_vexview() {
    shopt -s extglob 2>/dev/null
    local cur prev
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    local opts="-h --help -V --version -e --edit -f --fullscreen -s --slideshow -i --info -c --convert -q --quality --width --height --completions"

    case "${prev}" in
        --completions|--completion)
            COMPREPLY=( $(compgen -W "bash zsh fish powershell" -- "${cur}") )
            return 0
            ;;
        -q|--quality)
            COMPREPLY=( $(compgen -W "100 95 90 85 80 75 50" -- "${cur}") )
            return 0
            ;;
        --width|--height)
            COMPREPLY=( $(compgen -W "1920 1280 1080 800 640 512 256 128" -- "${cur}") )
            return 0
            ;;
        -c|--convert)
            if declare -F _filedir >/dev/null 2>&1; then
                _filedir
            else
                COMPREPLY=( $(compgen -f -- "${cur}") )
            fi
            return 0
            ;;
    esac

    if [[ "${cur}" == -* ]]; then
        COMPREPLY=( $(compgen -W "${opts}" -- "${cur}") )
        return 0
    fi

    local media_pattern="*.@(png|jpg|jpeg|webp|svg|gif|bmp|avif|tiff|ico|mp4|mkv|webm|mov|avi|flv|wmv|PNG|JPG|JPEG|WEBP|SVG|GIF|BMP|AVIF|TIFF|ICO|MP4|MKV|WEBM|MOV|AVI)"

    if declare -F _filedir >/dev/null 2>&1; then
        local media_exts="png|jpg|jpeg|webp|svg|gif|bmp|avif|tiff|ico|mp4|mkv|webm|mov|avi|PNG|JPG|JPEG|WEBP|SVG|GIF|BMP|AVIF|TIFF|ICO|MP4|MKV|WEBM|MOV|AVI"
        _filedir "@(${media_exts})"
    else
        local files dirs
        files=$(compgen -f -X "!${media_pattern}" -- "${cur}")
        dirs=$(compgen -d -S / -- "${cur}")
        COMPREPLY=( ${files} ${dirs} )
    fi
}
complete -F _vexview vexview
