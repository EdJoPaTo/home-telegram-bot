#!/usr/bin/env gnuplot

set datafile separator ","
set xdata time
set timefmt "%s"

set term pngcairo size 1280,800
set output dir."/".type.".png"

set xlabel "Time (UTC)"

set style line 100 lc rgb "black" lw 1 dashtype 3
set style line 101 lc rgb "dark-gray" lw 1 dashtype 3
set grid xtics mxtics ytics linestyle 100, linestyle 101
set style data lines
set format x "%d. %b"
set ytics format "%1.0f".unit
set xtics 60 * 60 * 24
set mxtics 4

plot for [i=1:words(files)] "data/".word(files, i)."-".type.".log" using 1:2 title word(files,i) linewidth 2
