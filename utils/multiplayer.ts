
import { Peer } from 'peerjs';
import { NetworkMessage } from '../types';

type DataCallback = (data: NetworkMessage) => void;

class MultiplayerManager {
  private peer: Peer | null = null;
  private connections: any[] = [];
  private onDataReceived: DataCallback | null = null;
  private myId: string = '';
  private roomName: string = 'UNO Room';

  initialize(onData: DataCallback) {
    this.onDataReceived = onData;
  }

  setRoomName(name: string) {
    this.roomName = name;
  }

  async hostGame(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create Peer with random ID
      this.peer = new Peer();

      this.peer.on('open', (id) => {
        this.myId = id;
        console.log('Hosting game with ID:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        console.log('New client connected:', conn.peer);
        
        conn.on('open', () => {
             this.connections.push(conn);
             // Send Room Info immediately
             conn.send({ type: 'ROOM_INFO', payload: { name: this.roomName } });
             
             // Inform app that someone joined (Update List)
             if (this.onDataReceived) {
                 this.onDataReceived({ type: 'PLAYER_JOINED', payload: { count: this.connections.length } }); 
             }
        });

        conn.on('data', (data: any) => {
            if (this.onDataReceived) this.onDataReceived(data);
        });
        
        conn.on('close', () => {
            // Remove closed connection
            this.connections = this.connections.filter(c => c.peer !== conn.peer);
            if (this.onDataReceived) {
                 this.onDataReceived({ type: 'PLAYER_LEFT', payload: { count: this.connections.length } });
            }
        });
      });

      this.peer.on('error', (err) => reject(err));
    });
  }

  async joinGame(hostId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.peer = new Peer();

      this.peer.on('open', (id) => {
        this.myId = id;
        const conn = this.peer!.connect(hostId);
        
        conn.on('open', () => {
          console.log('Connected to host:', hostId);
          this.connections.push(conn);
          resolve();
        });

        conn.on('data', (data: any) => {
            if (this.onDataReceived) this.onDataReceived(data);
            
            // Handle being kicked at the protocol level
            if (data.type === 'KICKED') {
                this.disconnect();
            }
        });
        
        conn.on('close', () => {
             if (this.onDataReceived) this.onDataReceived({ type: 'KICKED' }); // Generic disconnect signal
        });

        conn.on('error', (err) => reject(err));
      });

      this.peer.on('error', (err) => reject(err));
    });
  }

  kickClient(index: number) {
      const conn = this.connections[index];
      if (conn) {
          // Send polite notice
          conn.send({ type: 'KICKED' });
          
          // Close after short delay to ensure message sends
          setTimeout(() => {
              conn.close();
          }, 100);
          
          // Update local list immediately
          this.connections.splice(index, 1);
          if (this.onDataReceived) {
              this.onDataReceived({ type: 'PLAYER_LEFT', payload: { count: this.connections.length } });
          }
      }
  }

  broadcast(msg: NetworkMessage) {
    this.connections.forEach(conn => {
        if (conn.open) conn.send(msg);
    });
  }

  sendToHost(msg: NetworkMessage) {
      // Client only has one connection (the host)
      if (this.connections.length > 0 && this.connections[0].open) {
          this.connections[0].send(msg);
      }
  }

  disconnect() {
      this.connections.forEach(c => c.close());
      this.connections = [];
      if (this.peer) this.peer.destroy();
      this.peer = null;
  }

  getId() {
      return this.myId;
  }
}

export const mpManager = new MultiplayerManager();
