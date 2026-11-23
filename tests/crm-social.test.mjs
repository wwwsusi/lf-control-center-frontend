import test from 'node:test';import assert from 'node:assert/strict';
import {socialWeeks,sumWeeks,postsInRange,engagementRate,sortPosts,validateSocialReport,halves,halvesChange,weeklyAverage,periodLabel,isoWeek,engagementSeries,topPosts} from '../web/crm-social.mjs';

const w=(platform,week,start,end,o)=>({platform,week,period_start:start,period_end:end,revision:1,reach:null,media_views:null,interactions:null,new_followers:null,unfollows:null,profile_views:null,...o});
const social={accounts:{facebook:{followers_total:2392,following_total:null,posts_total:null}},covered_through:'2026-11-15',weekly:[
 w('facebook',45,'2026-11-02','2026-11-08',{reach:10368,media_views:24549,interactions:1171,new_followers:38,profile_views:1235}),
 w('instagram',45,'2026-11-02','2026-11-08',{reach:499,media_views:1688,interactions:80,new_followers:3,unfollows:1,profile_views:45}),
 w('facebook',46,'2026-11-09','2026-11-15',{reach:4187,media_views:11687,interactions:414,new_followers:6,profile_views:501}),
 w('instagram',46,'2026-11-09','2026-11-15',{reach:153,media_views:456,interactions:7,new_followers:0,unfollows:1,profile_views:25})],
 posts:[{platform:'facebook',post_id:'1_1',published_at:'2026-11-04T10:00:00.000Z',reach:6995,interactions:723,text:'Domáce úlohy'},
        {platform:'instagram',post_id:'2',published_at:'2026-11-11T10:00:00.000Z',reach:116,interactions:4,text:null},
        {platform:'facebook',post_id:'1_2',published_at:'2026-11-20T10:00:00.000Z',reach:0,interactions:3,text:'x'}]};
const visits=[{period_start:'2026-11-02',visits:285},{period_start:'2026-10-26',visits:234}];

test('weeks combine Facebook and Instagram and attach gym visits',()=>{
 const weeks=socialWeeks(validateSocialReport(social),visits);
 assert.equal(weeks.length,2);assert.equal(weeks[0].week,45);
 assert.equal(weeks[0].total.reach,10867);assert.equal(weeks[0].total.new_followers,41);
 assert.equal(weeks[0].fb.unfollows,null);assert.equal(weeks[0].total.unfollows,1);
 assert.equal(weeks[0].visits,285);assert.equal(weeks[1].visits,null);
});
test('all weeks are summed, visits only when complete',()=>{
 const t=sumWeeks(socialWeeks(social,visits));
 assert.equal(t.total.reach,15207);assert.equal(t.fb.new_followers,44);assert.equal(t.ig.unfollows,2);assert.equal(t.visits,null);
});
test('posts filter by period and engagement rate guards zero reach',()=>{
 assert.deepEqual(postsInRange(social.posts,'2026-11-09','2026-11-15').map(p=>p.post_id),['2']);
 assert.equal(engagementRate(social.posts[0]),10.3);assert.equal(engagementRate(social.posts[2]),null);
});
test('posts sort newest first by date, or by a metric',()=>{
 assert.deepEqual(sortPosts(social.posts,'date').map(p=>p.post_id),['1_2','2','1_1']);
 assert.deepEqual(sortPosts(social.posts,'reach').map(p=>p.post_id),['1_1','2','1_2']);
 assert.deepEqual(sortPosts(social.posts,'interactions').map(p=>p.post_id),['1_1','2','1_2']);
});
test('invalid payloads are rejected',()=>{
 assert.throws(()=>validateSocialReport({weekly:[{platform:'tiktok',week:1,period_start:'2026-01-05'}],posts:[],accounts:{}}));
 assert.throws(()=>validateSocialReport(null));
});
test('whole-period label, halves comparison and weekly average',()=>{
 const weeks=socialWeeks(social,visits);
 assert.equal(periodLabel(weeks),'W45–W46');assert.equal(halves(weeks).label,'W46–W46 / W45–W45');
 assert.equal(halvesChange(weeks,'reach'),-60.1);assert.equal(weeklyAverage(weeks,'reach'),7604);
 const seven=Array.from({length:7},(_,i)=>({week:40+i,total:{reach:100*(i+1)},fb:{},ig:{}}));
 assert.equal(halves(seven).label,'W44–W46 / W40–W42');assert.equal(halves([seven[0]]),null);
});
test('CW is the ISO week in Prague time',()=>{
 assert.equal(isoWeek('2026-11-20T10:00:00.000Z'),47);
 assert.equal(isoWeek('2026-11-15T23:30:00.000Z'),47); // already Monday 16 Nov in Prague
 assert.equal(isoWeek('2026-11-15T22:59:00.000Z'),46);
 assert.equal(isoWeek('2027-01-01T12:00:00.000Z'),53);
});

test('engagement series is interactions over reach per platform and never a fake 0 %',()=>{
 const weeks=socialWeeks(social,visits),e=engagementSeries(weeks);
 assert.deepEqual(e.facebook,[11.3,9.9]);assert.deepEqual(e.instagram,[16,4.6]);
 const none=engagementSeries([{fb:{reach:0,interactions:5},ig:null},{fb:{reach:100,interactions:null},ig:{reach:50,interactions:0}}]);
 assert.deepEqual(none.facebook,[null,null]);assert.deepEqual(none.instagram,[null,0]);
});
test('top posts: last four stored weeks, highest reach first, no empty reach, reels marked',()=>{
 const weeks=socialWeeks(social,visits);
 const posts=[...social.posts,{platform:'instagram',post_id:'3',published_at:'2026-11-12T10:00:00.000Z',media_type:'REELS',reach:900,interactions:50,text:'Reel text'}];
 const top=topPosts(posts,weeks);
 assert.deepEqual(top.map(p=>p.value),[6995,900,116]);          // '1_2' has reach 0 and is left out
 assert.match(top[0].label,/FB · Domáce úlohy/);assert.match(top[1].label,/IG reel · Reel text/);
 assert.match(top[0].title,/^4\. 11\. · FB · /);assert.doesNotMatch(top[0].label,/^\d/);   // date only in the tooltip
 assert.equal(top[0].platform,'facebook');assert.equal(top[1].platform,'instagram');
 assert.equal(topPosts(posts,weeks,{limit:1}).length,1);
 assert.deepEqual(topPosts(posts,[]),[]);
 // window counts from the newest stored week, not from today: spanWeeks=1 keeps only W46 posts
 assert.deepEqual(topPosts(posts,weeks,{spanWeeks:1}).map(p=>p.value),[900,116]);
});
