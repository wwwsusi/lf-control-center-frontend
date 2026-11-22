import test from 'node:test';import assert from 'node:assert/strict';
import {socialWeeks,sumWeeks,postsInRange,engagementRate,socialInsights,validateSocialReport} from '../web/crm-social.mjs';

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
test('insights compare with the previous week and mention missing visits',()=>{
 const weeks=socialWeeks(social,visits);
 const lines=socialInsights(weeks,'2026-11-09');
 assert.match(lines[0],/klesol o 60 %/);assert.match(lines.at(-1),/ešte nie sú/);
 assert.match(socialInsights(weeks,'all')[0],/W45/);
});
test('invalid payloads are rejected',()=>{
 assert.throws(()=>validateSocialReport({weekly:[{platform:'tiktok',week:1,period_start:'2026-01-05'}],posts:[],accounts:{}}));
 assert.throws(()=>validateSocialReport(null));
});
