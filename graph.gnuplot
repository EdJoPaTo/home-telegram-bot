set datafile separator ","
set xdata time
set timefmt "%s"

set term png size 1000,800
set output "tmp/".type.".png"

set title "Temperature Sensors"
set xlabel "Time (UTC)"

set grid
set style data lines
set format x "%d. %b %H:%M"
set ytics format "%1.0f".unit
set xtics 60 * 60 * 6

plot for [i=1:words(files)] "data/".word(files, i)."-".type.".log" using 1:2 title word(files,i) linewidth 2
