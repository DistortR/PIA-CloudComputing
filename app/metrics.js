const buckets = [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, Infinity];

function quote(value) {
  return '"' + value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n") + '"';
}

export function createMetrics(version) {
  const series = new Map();
  const versionLabel = `version=${quote(version)}`;

  return {
    observe(method, route, status, seconds) {
      const labels = `method=${quote(method)},route=${quote(route)}`;
      if (!series.has(labels)) {
        series.set(labels, { statuses: new Map(), counts: buckets.map(() => 0), count: 0, sum: 0 });
      }

      const record = series.get(labels);
      record.statuses.set(status, (record.statuses.get(status) ?? 0) + 1);
      record.count++;
      record.sum += seconds;
      buckets.forEach((bound, index) => {
        if (seconds <= bound) record.counts[index]++;
      });
    },
    render() {
      const requests = [
        "# HELP http_requests_total Total de peticiones HTTP.",
        "# TYPE http_requests_total counter",
      ];
      const duration = [
        "# HELP http_request_duration_seconds Duracion de peticiones HTTP en segundos.",
        "# TYPE http_request_duration_seconds histogram",
      ];

      for (const [routeLabels, record] of series) {
        const labels = `${routeLabels},${versionLabel}`;
        for (const [status, count] of record.statuses) {
          requests.push(`http_requests_total{${routeLabels},status="${status}",${versionLabel}} ${count}`);
        }
        buckets.forEach((bound, index) => {
          const limit = bound === Infinity ? "+Inf" : bound;
          duration.push(`http_request_duration_seconds_bucket{${labels},le="${limit}"} ${record.counts[index]}`);
        });
        duration.push(`http_request_duration_seconds_sum{${labels}} ${record.sum}`);
        duration.push(`http_request_duration_seconds_count{${labels}} ${record.count}`);
      }
      return [...requests, ...duration, ""].join("\n");
    },
  };
}
