from typing import List, Dict, Tuple

class AlphaHRDiffEngine:
    def __init__(self):
        pass

    def compute_diff(self, snapshots_t1: List[Dict], snapshots_t2: List[Dict]) -> Dict:
        """
        Compares two lists of Job Snapshots (t-1 vs t) and returns a Diff Report.
        
        Args:
            snapshots_t1: Last week's data
            snapshots_t2: This week's data
            
        Returns:
            {
                "new_jobs": [],
                "closed_jobs": [],
                "team_stats": { "TeamA": { "change": +2, "pct": 20.0 } },
                "spikes": ["TeamA"] 
            }
        """
        # 1. Create sets for easy comparison
        # Assuming we can identify unique jobs by title+team (simplified)
        # In prod, we'd need a stable ID.
        
        def _get_key(job):
            return f"{job.get('team_name', 'Unknown')}:{job.get('job_title', 'Unknown')}"

        set_t1 = {_get_key(j): j for j in snapshots_t1}
        set_t2 = {_get_key(j): j for j in snapshots_t2}
        
        new_keys = set(set_t2.keys()) - set(set_t1.keys())
        closed_keys = set(set_t1.keys()) - set(set_t2.keys())
        
        new_jobs = [set_t2[k] for k in new_keys]
        closed_jobs = [set_t1[k] for k in closed_keys]
        
        # 2. Team Statistics & Spikes
        team_counts_t1 = self._count_by_team(snapshots_t1)
        team_counts_t2 = self._count_by_team(snapshots_t2)
        
        team_stats = {}
        spikes = []
        
        all_teams = set(team_counts_t1.keys()) | set(team_counts_t2.keys())
        
        for team in all_teams:
            c1 = team_counts_t1.get(team, 0)
            c2 = team_counts_t2.get(team, 0)
            change = c2 - c1
            
            pct_change = 0.0
            if c1 > 0:
                pct_change = (change / c1) * 100
            elif c2 > 0:
                pct_change = 100.0 # New team creation
            
            team_stats[team] = {
                "count_t1": c1,
                "count_t2": c2,
                "change": change,
                "pct_change": round(pct_change, 2)
            }
            
            # Spike Detection Rule: > +20% change and strictly positive growth (and base > 2 for noise reduction)
            if pct_change >= 20.0 and c2 > 2:
                spikes.append(team)

        return {
            "new_jobs": new_jobs,
            "closed_jobs": closed_jobs,
            "team_stats": team_stats,
            "spikes": spikes
        }

    def _count_by_team(self, snapshots: List[Dict]) -> Dict[str, int]:
        counts = {}
        for job in snapshots:
            team = job.get('team_name', 'Unknown')
            counts[team] = counts.get(team, 0) + 1
        return counts

if __name__ == "__main__":
    engine = AlphaHRDiffEngine()
    t1 = [
        {"team_name": "AI", "job_title": "Engineer A"},
        {"team_name": "AI", "job_title": "Engineer B"},
        {"team_name": "Web", "job_title": "Frontend dev"}
    ]
    t2 = [
        {"team_name": "AI", "job_title": "Engineer A"},
        {"team_name": "AI", "job_title": "Engineer B"},
        {"team_name": "AI", "job_title": "Engineer C"}, # New
        {"team_name": "AI", "job_title": "Engineer D"}, # New -> Spike (2->4 = 100%)
        {"team_name": "Mobile", "job_title": "iOS Dev"}  # New Team
    ]
    
    diff = engine.compute_diff(t1, t2)
    print(json.dumps(diff, indent=2))
