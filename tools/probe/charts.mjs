// Opens every chart of every provider through the app's own provider layer
// and asks for the address of its first unrestricted song.
//
//   node tools/probe/charts.mjs <network label>
//
// The label is what the user calls the network, as in wifi or mobile. The
// result goes to the console; keep it under references/probe.
import { loadSource } from '../test/load-state.mjs';

const label = process.argv[2] || '未告知';
const { default: Client } = await loadSource('src/api/client.ts');

console.log(`榜单探测 ${new Date().toISOString()} 网络标签 ${label}`);

for (const chart of Client.getCharts()) {
  const name = `${Client.getProviderName(chart.source)} ${chart.title} (${chart.id})`;

  try {
    const playlist = await Client.getPlaylist(chart.id);
    const restricted = playlist.tracks.filter(track => track.disabled).length;
    const first = playlist.tracks.find(track => !track.disabled);
    let address = '没有不受限的歌曲';

    if (first) {
      const url = await Client.bootstrapTrack(first.id).catch(
        error => `取址失败 ${error.message}`
      );

      address = `${first.title} - ${first.artist}: ${
        url === '' ? '取址为空' : String(url).slice(0, 40)
      }`;
    }
    console.log(
      `${name}: 标题「${playlist.info.title}」 ${playlist.tracks.length} 首，受限 ${restricted} 首，封面 ${
        playlist.info.cover_img_url ? '有' : '无'
      }；${address}`
    );
  } catch (error) {
    console.log(`${name}: 失败 ${error.message}`);
  }
}
