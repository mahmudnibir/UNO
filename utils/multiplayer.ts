
import { Peer } from 'peerjs';
import { NetworkMessage } from '../types';

type DataCallback = (data: NetworkMessage) => void;

class MultiplayerManager {
  private peer: Peer | null = null;
  private connections: any[] = [];
  private onDataReceived: DataCallback | null = null;
  private myId: string = '';

  initialize(onData: DataCallback) {
    this.onDataReceived = onData;
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
        this.connections.push(conn);
        
        conn.on('data', (data: any) => {
            if (this.onDataReceived) this.onDataReceived(data);
        });

        conn.on('open', () => {
             // Inform app that someone joined
             if (this.onDataReceived) {
                 this.onDataReceived({ type: 'PLAYER_JOINED', playerId: this.connections.length }); // Simple ID assignment
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
        });

        conn.on('error', (err) => reject(err));
      });

      this.peer.on('error', (err) => reject(err));
    });
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
