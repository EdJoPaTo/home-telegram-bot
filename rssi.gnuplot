set datafile separator ","
set xdata time
# Example: 2018-06-25T21:50:56.551Z
set timefmt "%s"

set term png size 1000,800
set output "tmp/rssi.png"

set title "Temperature Sensors"
set ylabel "RSSI"
set xlabel "Time (UTC)"

set grid
set style data lines
set format x "%d. %b %H:%M"
set ytics format "%1.0f dBm"
set xtics 60 * 60 * 6

plot for [i=1:words(files)] "data/".word(files, i)."-rssi.log" using 1:2 title word(files,i) linewidth 2
