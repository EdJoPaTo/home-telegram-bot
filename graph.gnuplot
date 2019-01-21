#!/usr/bin/env gnuplot

set datafile separator ","
set xdata time
set timefmt "%s"

set term pngcairo size 1280,800
set output dir."/".type.".png"

set xlabel "Time (UTC)"

set key outside
set style line 100 lc rgb "black" lw 1 dashtype 3
set style line 101 lc rgb "dark-gray" lw 1 dashtype 3
set grid xtics mxtics ytics linestyle 100, linestyle 101
set style data lines
set ytics format "%1.0f".unit

plot for [i=1:words(files)] "data/".word(files, i)."/".type.".log" using 1:2 title word(fileLabels,i) linewidth 2
