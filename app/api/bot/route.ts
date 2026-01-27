import { NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// 봇 서버 프로세스 PID 추적
let botProcess: ReturnType<typeof spawn> | null = null;

export async function GET() {
    try {
        // main_auto.py 프로세스가 실행 중인지 확인
        const { stdout } = await execAsync('pgrep -f "python.*main_auto.py"');
        const pids = stdout.trim().split('\n').filter(Boolean);

        return NextResponse.json({
            running: pids.length > 0,
            pids,
        });
    } catch {
        // pgrep이 프로세스를 찾지 못하면 에러 코드 반환
        return NextResponse.json({
            running: false,
            pids: [],
        });
    }
}

export async function POST(request: Request) {
    const { action } = await request.json();
    const aiEnginePath = path.join(process.cwd(), 'services', 'ai-engine');

    if (action === 'start') {
        try {
            // 이미 실행 중인지 확인
            const { stdout } = await execAsync('pgrep -f "python.*main_auto.py"').catch(() => ({ stdout: '' }));
            if (stdout.trim()) {
                return NextResponse.json({ success: false, message: '이미 실행 중입니다.' });
            }

            // 백그라운드에서 봇 서버 시작
            const pythonPath = path.join(aiEnginePath, 'venv', 'bin', 'python');
            const scriptPath = path.join(aiEnginePath, 'main_auto.py');

            botProcess = spawn(pythonPath, [scriptPath], {
                cwd: aiEnginePath,
                detached: true,
                stdio: 'ignore',
            });

            botProcess.unref();

            return NextResponse.json({
                success: true,
                message: '봇 서버가 시작되었습니다.',
                pid: botProcess.pid
            });
        } catch (error) {
            return NextResponse.json({
                success: false,
                message: `시작 실패: ${error}`
            }, { status: 500 });
        }
    }

    if (action === 'stop') {
        try {
            // main_auto.py 프로세스 종료
            await execAsync('pkill -f "python.*main_auto.py"');
            botProcess = null;

            return NextResponse.json({
                success: true,
                message: '봇 서버가 종료되었습니다.'
            });
        } catch (error) {
            return NextResponse.json({
                success: false,
                message: `종료 실패: ${error}`
            }, { status: 500 });
        }
    }

    return NextResponse.json({
        success: false,
        message: 'Invalid action'
    }, { status: 400 });
}
