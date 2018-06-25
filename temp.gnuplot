set datafile separator ","
set xdata time
# Example: 2018-06-25T21:50:56.551Z
set timefmt "%s"

set term png size 1000,800
set output "tmp/temp.png"

set title "Temperature Sensors"
set ylabel "Temperature"
set xlabel "Time (UTC)"

set grid
set style data lines
set format x "%d. %b %H:%M"
set ytics format "%1.1f °C"
set xtics 3600

plot for [i=1:words(files)] "data/".word(files, i)."-temp.log" using 1:2 title word(files,i) linewidth 2
